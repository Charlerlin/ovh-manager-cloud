"use strict";

angular.module("managerApp").controller("CloudProjectAddCtrl",
    function ($q, $state, $timeout, $translate, $rootScope, $window, Toast, REDIRECT_URLS, FeatureAvailabilityService, OvhApiCloud,
              OvhApiMe, OvhApiOrder, OvhApiVrack, OvhApiMePaymentMeanCreditCard, SidebarMenu, CloudProjectSidebar,
              CloudProjectAdd, CloudProjectAddService, CloudPoll) {

        var self = this;

        this.loaders = {
            init: true,
            creating: false
        };

        this.data = {
            isFirstProjectCreation: true,
            status: null,                // project creation status
            agreements: [],              // contracts agreements
            defaultPaymentMean: null,
            projectPrice: null,          // price for creating a new project with BC
            availablePaymentMeans: {     // list of available payment means
                creditCard: false,
                bankAccount: false,
                paypal: false
            },
            hasDebt: false,              // true if user has debt (fidelity account balance < 0)
            hasBill: false               // true if user has at least one bill
        };

        this.model = {
            description: "",             // new project name
            contractsAccepted: false,
            voucher: null,
            paymentMethod: null,         // user choosen payment method (either MEAN or BC)
            noPaymentMethodEnum: _.indexBy(["MEAN", "BC"]),
            catalogVersion: null         //  null == latest 1 === old catalog
        };

        // PaymentMean URL (v6 dedicated) with sessionv6
        this.paymentmeanUrl = REDIRECT_URLS.paymentMeans;
        // Add credit card URL
        this.addCreditCardUrl = REDIRECT_URLS.addCreditCard;

        /**
         * Launch project creation process
         */
        this.createProject = function () {
            var promiseContracts = true;
            self.loaders.creating = true;

            // If contracts: accept them
            if (self.model.contractsAccepted && self.data.agreements.length) {
                var queueContracts = [];
                angular.forEach(self.data.agreements, function (contract) {
                    queueContracts.push(OvhApiMe.Agreements().Lexi().accept({
                        id: contract.id
                    }, {}).$promise.then(function () {
                        _.remove(self.data.agreements, {
                            id: contract.id
                        });
                    }));
                });
                promiseContracts = $q.all(queueContracts);
            }

            return CloudProjectAddService.orderCloudProject(self.model.description, self.model.voucher)
                .then(response => {
                    self.data.activeOrder = response;

                    if (response.prices.withTax.value) {
                        $window.open(response.url);
                    }

                    self.pollOrder(response.orderId);
                })
                .catch(error => {
                    self.data.activeOrder = undefined;
                    Toast.error($translate.instant("cpa_error", error.data));
                })
                .finally(() => {
                    self.loaders.creating = false;
                });
        };

        this.pollOrder = function (orderId) {
            const cloudOrder = {};
            if (self.data.poller) {
                self.data.poller.kill();
            }

            self.data.poller = CloudPoll.poll({
                item: cloudOrder,
                pollFunction: () => CloudProjectAddService.getCloudProjectOrder(orderId).then(response => {
                        return response || {};
                    }),
                stopCondition: item => item.status === "delivered",
                interval: 3000
            });
            
            self.data.poller.$promise
                .then(() => {
                    self.data.projectReady = true;
                    return $timeout(() => {
                        CloudProjectSidebar.addToSection({
                            project_id: cloudOrder.serviceName, // jshint ignore:line
                            description: self.model.description
                        });
                        OvhApiVrack.Lexi().resetCache();
                        OvhApiVrack.CloudProject().Lexi().resetQueryCache();

                        $state.go("iaas.pci-project.compute", {
                            projectId: cloudOrder.serviceName
                        });
                    }, 3000);
                })
                .catch(() => Toast.error($translate.instant("cpa_error")));

            return self.data.poller;
        }

        // returns true if user has at least one bill and no debt
        this.isTrustedUser = function () {
            return this.has3dsCreditCard() || (self.data.hasBill && !self.data.hasDebt);
        };

        // returns true if user has at least one 3D secure registered credit card
        this.has3dsCreditCard = function () {
            return angular.isDefined(_.find(self.data.creditCards, "threeDsValidated"));
        };

        function initUserFidelityAccount () {
            return OvhApiMe.FidelityAccount().Lexi().get().$promise.then(function (account) {
                return $q.when(account);
            }, function (err) {
                return err && err.status === 404 ? $q.when(null) : $q.reject(err);
            });
        }

        function initContracts () {
            return CloudProjectAdd.getProjectInfo()
                .then(projectInfo => {
                    self.data.agreements = projectInfo.agreementsToAccept;
                });
        }

        function initProject () {
            return $q.all({
                projectIds:       OvhApiCloud.Project().Lexi().query().$promise,
                price:            OvhApiCloud.Price().Lexi().query().$promise,
                user:             OvhApiMe.Lexi().get().$promise,
                defaultPayment:   OvhApiMe.PaymentMean().Lexi().getDefaultPaymentMean(),
                availablePayment: OvhApiMe.AvailableAutomaticPaymentMeans().Lexi().get().$promise,
                fidelityAccount:  initUserFidelityAccount(),
                bill:             OvhApiMe.Bill().Lexi().query().$promise,
                creditCards:      OvhApiMePaymentMeanCreditCard.Lexi().getCreditCards()
            }).then(function (result) {
                self.data.projectReady = false;
                self.data.isFirstProjectCreation = result.projectIds.length;
                self.data.projectPrice = result.price.projectCreation;
                self.data.defaultPaymentMean = result.defaultPayment;
                self.data.availablePaymentMeans = result.availablePayment;
                self.data.hasDebt = result.fidelityAccount && result.fidelityAccount.balance < 0;
                self.data.hasBill = result.bill.length > 0;
                self.data.creditCards = result.creditCards;
                self.data.user = result.user;
                self.model.description = $translate.instant("cloud_menu_project_num", { num: result.projectIds.length + 1 });
                self.model.paymentMethod = self.model.noPaymentMethodEnum.MEAN;
            });
        }

        function init () {
            self.loaders.init = true;
            // Redirect US to onboarding
            if (FeatureAvailabilityService.hasFeature("PROJECT","expressOrder")) {
                $state.go("iaas.pci-project-onboarding", { location : "replace" });
                return;
            }
            initContracts().then(initProject)["catch"](function (err) {
                self.unknownError = true;
                Toast.error($translate.instant("cpa_error") + (err && err.data && err.data.message ? " (" + err.data.message + ")" : ""));
            })["finally"](function () {
                self.loaders.init = false;
            });
        }

        init();
    });
