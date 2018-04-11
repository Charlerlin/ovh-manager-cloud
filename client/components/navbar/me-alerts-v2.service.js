class MeAlertsV2Service {
    constructor ($compile, $translate, $q, CloudMessage, OvhApiMeAlertsAapi, TARGET, UNIVERSE) {
        this.$compile = $compile;
        this.$translate = $translate;
        this.$q = $q;
        this.CloudMessage = CloudMessage;
        this.UserAlertsAapi = OvhApiMeAlertsAapi;
        this.TARGET = TARGET;
        this.UNIVERSE = UNIVERSE;
    }

    getMessages () {
        return this.$q((resolve, reject) => {
            this.$translate.refresh().then(() => {
                this.UserAlertsAapi.query({
                        lang: this.$translate.preferredLanguage(),
                        target: this.TARGET,
                        universe: this.UNIVERSE
                    }).$promise
                    .then(messages => {
                        resolve(messages);
                    })
                    .catch(error => {
                        this.CloudMessage.error({ textHtml: error.message }, "index");
                        reject(error);
                    });
                }
            );
        });
    }

    getSubLinks () {
        return this.getMessages().then(messages => {
            console.log(messages);
            messages[0].status = "delivered";
            return messages.map(message => this.convertSubLink(message));
        });
    }

    convertSubLink (task) {
        return {
            title: task.description,
            url: `#/status/task/${task.id}`,
            template:
            `<div class="clearfix">
                <h4>Mes services</h4>⬤
                <i>${moment(task.date).fromNow()}</i>
                <div>${task.description}</div>
            </div>`
        };
    }

    getNavbarContent () {
        return this.getSubLinks().then(sublinks => {
            const navbarContent = {
                name: "notifications",
                title: this.$translate.instant("status_menu_title"),
                iconClass: "icon-notifications",
                limitTo: 10,
                footerTitle: this.$translate.instant("status_menu_see_all"),
                footerUrl: "#/status/task",
                subLinks: sublinks,
                show: true
            };
            return navbarContent;
        });
    }
}

angular.module("managerApp").service("MeAlertsV2Service", MeAlertsV2Service);
