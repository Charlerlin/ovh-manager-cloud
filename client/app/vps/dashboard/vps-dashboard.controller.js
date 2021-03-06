class VpsDashboardCtrl {
    constructor ($filter, $q, $scope, $state, $stateParams, $translate, CloudMessage, ControllerHelper, VpsActionService, VpsService) {
        this.$filter = $filter;
        this.$q = $q;
        this.$scope = $scope;
        this.$state = $state;
        this.$stateParams = $stateParams;
        this.$translate = $translate;
        this.ControllerHelper = ControllerHelper;
        this.CloudMessage = CloudMessage;
        this.serviceName = $stateParams.serviceName;
        this.VpsActionService = VpsActionService;
        this.VpsService = VpsService;

        this.plan = {};
        this.summary = {};
        this.vps = {};

        this.loaders = {
            disk: false,
            ip: false,
            polling: false
        };
    }

    initLoaders () {
        this.vps = this.ControllerHelper.request.getHashLoader({
            loaderFunction: () => this.VpsService.getSelectedVps(this.serviceName),
            successHandler: () => {
                if (!this.vps.data.isExpired) {
                    this.loadIps();
                    this.hasAdditionalDiskOption();
                }
            }
        });
        this.summary = this.ControllerHelper.request.getHashLoader({
            loaderFunction: () => this.VpsService.getTabSummary(this.serviceName, true),
            successHandler: () => this.initOptionsActions()
        });
        this.plan = this.ControllerHelper.request.getHashLoader({
            loaderFunction: () => this.VpsService.getServiceInfos(this.serviceName),
        });
    }

    $onInit () {
        this.initActions();
        this.initLoaders();

        this.vps.load();
        this.summary.load();
        this.plan.load();

        this.$scope.$on("tasks.pending", (event, opt) => {
            if (opt === this.serviceName) {
                this.loaders.polling = true;
            }
        });
        this.$scope.$on("tasks.success", (event, opt) => {
            if (opt === this.serviceName) {
                this.loaders.polling = false;
                this.vps.load();
            }
        });
    }

    loadIps () {
        this.loaders.ips = true;
        this.VpsService.getIps(this.serviceName).then(ips => {
            this.vps.data.ipv6Gateway = _.get(_.find(ips.results, { version: "v6" }), "gateway");
            this.loaders.ips = false;
        });
    }

    hasAdditionalDiskOption () {
        if (!_.include(this.vps.data.availableOptions, "ADDITIONAL_DISK")) {
            return this.hasAdditionalDisk = false;
        }
        return this.loadAdditionalDisks();
    }

    loadAdditionalDisks () {
        this.loaders.disk = true;
        this.hasAdditionalDisk = true;
        this.VpsService.getDisks(this.serviceName)
            .then(data => {
                const promises = _.map(data, elem => { return this.VpsService.getDiskInfo(this.serviceName, elem) });
                return this.$q.all(promises)
                    .then(data => {
                        this.additionnalDisks = this.VpsService.showOnlyAdditionalDisk(data);
                        this.canOrderDisk = _.isEmpty(this.additionnalDisks);
                    });
            })
            .catch(error => {
                this.CloudMessage.error(error || this.$translate.instant("vps_additional_disk_info_fail"));
                return this.$q.reject(error);
            })
            .finally(() => { this.loaders.disk = false });
    }

    initBackupStorageActions () {
        this.backupStorageActions = {
            manage: {
                text: this.$translate.instant("common_manage"),
                state: "iaas.vps.detail.backup-storage",
                stateParams: { serviceName: this.serviceName },
                isAvailable: () => !this.vps.loading
            },
            order: {
                text: this.$translate.instant("common_order"),
                state: "iaas.vps.detail.backup-storage.order",
                stateParams: { serviceName: this.serviceName },
                isAvailable: () => !this.vps.loading
            },
            terminate: {
                text: this.$translate.instant("vps_configuration_desactivate_option"),
                callback: () => this.VpsActionService.terminateBackupStorageOption(this.serviceName),
                isAvailable: () => !this.vps.loading
            }
        };
    }

    initSnapshotActions () {
        this.snapshotDescription = this.summary.data.snapshot.creationDate ?
            this.$translate.instant("vps_tab_SUMMARY_snapshot_creationdate") + " " + moment(this.summary.data.snapshot.creationDate).format("LLL") :
            this.$translate.instant("vps_status_enabled");
        this.snapshotActions = {
            delete: {
                text: this.$translate.instant("vps_configuration_delete_snapshot_title_button"),
                callback: () => this.VpsActionService.deleteSnapshot(this.serviceName),
                isAvailable: () => !this.summary.loading && this.summary.data.snapshot.creationDate && !this.loaders.polling
            },
            order: {
                text: this.$translate.instant("common_order"),
                state: "iaas.vps.detail.snapshot-order",
                stateParams: { serviceName: this.serviceName },
                isAvailable: () => !this.summary.loading && this.summary.data.snapshot.optionAvailable
            },
            restore: {
                text: this.$translate.instant("vps_configuration_snapshot_restore_title_button"),
                callback: () => this.VpsActionService.restoreSnapshot(this.serviceName),
                isAvailable: () => !this.summary.loading && this.summary.data.snapshot.creationDate  && !this.loaders.polling
            },
            take: {
                text: this.$translate.instant("vps_configuration_snapshot_take_title_button"),
                callback: () => this.VpsActionService.takeSnapshot(this.serviceName),
                isAvailable: () => !this.summary.loading && this.summary.data.snapshot.optionActivated && !this.summary.data.snapshot.creationDate  && !this.loaders.polling
            },
            terminate: {
                text: this.$translate.instant("vps_configuration_desactivate_option"),
                callback: () => this.VpsActionService.terminateSnapshotOption(this.serviceName),
                isAvailable: () => !this.summary.loading && this.summary.data.snapshot.optionActivated
            }
        };
    }

    initVeeamActions () {
        this.veeamActions = {
            manage: {
                text: this.$translate.instant("common_manage"),
                state: "iaas.vps.detail.veeam",
                stateParams: { serviceName: this.serviceName },
                isAvailable: () => !this.vps.loading
            },
            order: {
                text: this.$translate.instant("common_order"),
                state: "iaas.vps.detail.veeam.order",
                stateParams: { serviceName: this.serviceName },
                isAvailable: () => !this.vps.loading
            },
            terminate: {
                text: this.$translate.instant("vps_configuration_desactivate_option"),
                callback: () => this.VpsActionService.terminateVeeamOption(this.serviceName),
                isAvailable: () => !this.vps.loading
            }
        };
    }

    initOptionsActions () {
        this.initBackupStorageActions();
        this.initSnapshotActions();
        this.initVeeamActions();
    }

    initActions () {
        this.actions = {
            changeName: {
                text: this.$translate.instant("common_edit"),
                callback: () => this.VpsActionService.editName(this.vps.data.displayName, this.serviceName).then(() => this.vps.load()),
                isAvailable: () => !this.vps.loading
            },
            changeOwner: {
                text: this.$translate.instant("vps_change_owner"),
                atInternetClickTag: "VPS-Actions-ChangeOwner",
                isAvailable: () => !this.loaders.url
            },
            kvm: {
                text: this.$translate.instant("vps_configuration_kvm_title_button"),
                callback: () => this.VpsActionService.kvm(this.serviceName, this.vps.data.noVNC),
                isAvailable: () => !this.loaders.polling && !this.vps.loading
            },
            manageAutorenew: {
                text: this.$translate.instant("common_manage"),
                href: this.ControllerHelper.navigation.getUrl("renew", { serviceName: this.serviceName, serviceType: "VPS" }),
                isAvailable: () => !this.vps.loading && !this.loaders.plan
            },
            manageContact: {
                text: this.$translate.instant("common_manage"),
                href: this.ControllerHelper.navigation.getUrl("contacts", { serviceName: this.serviceName }),
                isAvailable: () => !this.vps.loading
            },
            manageIps: {
                text: this.$translate.instant("vps_configuration_add_ipv4_title_button"),
                href: this.ControllerHelper.navigation.getUrl("ip", { serviceName: this.serviceName }),
                isAvailable: () => !this.vps.loading && !this.loaders.ip
            },
            displayIps: {
                text: this.$translate.instant("vps_dashboard_ips_additional"),
                callback: () => this.VpsActionService.displayIps(this.serviceName),
                isAvailable: () => !this.vps.loading && !this.loaders.ip
            },
            manageSla: {
                text: this.$translate.instant("common_manage"),
                callback: () => this.VpsActionService.monitoringSla(this.serviceName, !this.vps.data.slaMonitoring),
                isAvailable: () => !this.vps.loading && !this.loaders.polling
            },
            viewIpSla: {
                text: this.$translate.instant("vps_dashboard_monitoring_sla_ips"),
                callback: () => this.VpsActionService.monitoringSla(this.serviceName, true, true),
                isAvailable: () => !this.vps.loading
            },
            // orderAdditionalDiskOption: {
            //     text: this.$translate.instant("vps_additional_disk_add_button"),
            //     state: "iaas.vps.detail.additional-disk.order",
            //     stateParams: { serviceName: this.serviceName },
            //     isAvailable: () => !this.loaders.disk && this.canOrderDisk
            // },
            orderAdditionalDiskOption: {
                text: this.$translate.instant("vps_additional_disk_add_button"),
                callback: () => this.$state.go("iaas.vps.detail.additional-disk.order"),
                isAvailable: () => !this.loaders.disk && this.canOrderDisk
            },
            orderWindows: {
                text: this.$translate.instant("common_order"),
                state: "iaas.vps.detail.windows-order",
                stateParams: { serviceName: this.serviceName },
                isAvailable: () => !this.summary.loading && !this.summary.windowsActivated
            },
            reboot: {
                text: this.$translate.instant("vps_configuration_reboot_title_button"),
                callback: () => this.VpsActionService.reboot(this.serviceName),
                isAvailable: () => !this.loaders.polling && !this.vps.loading
            },
            reinstall: {
                text: this.$translate.instant("vps_configuration_reinstall_title_button"),
                callback: () => this.VpsActionService.reinstall(this.serviceName),
                isAvailable: () => !this.loaders.polling && !this.vps.loading
            },
            rebootRescue: {
                text: this.$translate.instant("vps_configuration_reboot_rescue"),
                callback: () => this.VpsActionService.rescue(this.serviceName),
                isAvailable: () => !this.loaders.polling && !this.vps.loading
            },
            reverseDns: {
                text: this.$translate.instant("vps_configuration_reversedns_title_button"),
                callback: () => this.VpsActionService.reverseDns(this.serviceName),
                isAvailable: () => !this.loaders.ip
            },
            terminateAdditionalDiskOption: {
                text: this.$translate.instant("vps_configuration_desactivate_option"),
                callback: () => this.VpsActionService.terminateAdditionalDiskOption(this.serviceName),
                isAvailable: () => !this.loaders.disk && !this.canOrderDisk
            },
            terminateWindows: {
                text: this.$translate.instant("vps_configuration_desactivate_option"),
                callback: () => this.VpsActionService.terminateWindows(this.serviceName),
                isAvailable: () => !this.summary.loading && this.summary.data.windowsActivated
            },
            upgrade: {
                text: this.$translate.instant("vps_configuration_upgradevps_title_button"),
                state: "iaas.vps.detail.upgrade",
                stateParams: { serviceName: this.serviceName },
                isAvailable: () => !this.loaders.polling && !this.vps.loading
            }
        };
        this.ControllerHelper.navigation.getConstant("changeOwner").then(url => { this.actions.changeOwner.href = url; });
    }

}

angular.module("managerApp").controller("VpsDashboardCtrl", VpsDashboardCtrl);
