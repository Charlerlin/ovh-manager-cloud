class AlertsHomeCtrl {
    constructor ($state, $stateParams, $translate, CloudMessage, ControllerHelper, LogsStreamsService, StreamsAlertsConstant, StreamsAlertsService) {
        this.$state = $state;
        this.$stateParams = $stateParams;
        this.$translate = $translate;
        this.CloudMessage = CloudMessage;
        this.ControllerHelper = ControllerHelper;
        this.LogsStreamsService = LogsStreamsService;
        this.StreamsAlertsConstant = StreamsAlertsConstant;
        this.StreamsAlertsService = StreamsAlertsService;

        this.serviceName = this.$stateParams.serviceName;
        this.streamId = this.$stateParams.streamId;
        this._initLoaders();
    }

    $onInit () {
        this.runLoaders();
    }

    runLoaders () {
        this.alertIds.load();
        this.stream.load();
    }

    /**
     * initializes the alertsIDs and current stream
     *
     * @memberof AlertsHomeCtrl
     */
    _initLoaders () {
        this.alertIds = this.ControllerHelper.request.getArrayLoader({
            loaderFunction: () => this.StreamsAlertsService.getAlertIds(this.serviceName, this.streamId)
        });
        this.stream = this.ControllerHelper.request.getHashLoader({
            loaderFunction: () => this.LogsStreamsService.getStream(this.serviceName, this.streamId)
        });
    }

    loadAlerts ({ offset, pageSize }) {
        return this.StreamsAlertsService.getAlerts(
            this.serviceName,
            this.streamId,
            this.alertIds.data.slice(offset - 1, offset + pageSize - 1)
        ).then(alerts => ({
            data: alerts,
            meta: {
                totalCount: this.alertIds.data.length
            }
        }));
    }

    showDeleteConfirm (alert) {
        this.CloudMessage.flushChildMessage();
        return this.ControllerHelper.modal.showDeleteModal({
            titleText: this.$translate.instant("streams_alerts_delete"),
            text: this.$translate.instant("streams_alerts_delete_message", { alert: alert.title })
        }).then(() => this.delete(alert));
    }

    delete (alert) {
        this.delete = this.ControllerHelper.request.getHashLoader({
            loaderFunction: () =>
                this.StreamsAlertsService.deleteAlert(this.serviceName, this.streamId, alert.alertId)
                    .then(() => this.runLoaders())
        });
        this.alertIds.loading = true;
        this.delete.load();
    }

    addAlert (type) {
        this.$state.go("dbaas.logs.detail.streams.alerts.add", {
            serviceName: this.serviceName,
            streamId: this.streamId,
            type: this.StreamsAlertsConstant.alertType[type]
        });
    }
}

angular.module("managerApp").controller("AlertsHomeCtrl", AlertsHomeCtrl);
