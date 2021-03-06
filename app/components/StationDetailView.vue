<template>
    <Page class="page plain" actionBarHidden="true" @loaded="onPageLoaded" @unloaded="onUnloaded">
        <GridLayout :rows="notificationCodes.length > 0 ? '*,35,55' : '*,55'">
            <ScrollView row="0">
                <FlexboxLayout flexDirection="column" class="p-t-10">
                    <ScreenHeader
                        order="1"
                        :title="currentStation.name"
                        :subtitle="deployedStatus"
                        :onBack="goBack"
                        :onSettings="goToSettings"
                    />

                    <!-- loading animation -->
                    <GridLayout order="2" rows="auto" columns="*" v-if="loading" class="text-center">
                        <StackLayout id="loading-circle-blue"></StackLayout>
                        <StackLayout id="loading-circle-white"></StackLayout>
                    </GridLayout>

                    <!-- grid to allow overlapping elements -->
                    <GridLayout order="3" rows="*" columns="*">
                        <!-- background elements -->
                        <GridLayout row="0" col="0">
                            <FlexboxLayout flexDirection="column">
                                <!-- station status details -->
                                <StationStatusBox order="1" ref="statusBox" @deployTapped="goToDeploy" />
                                <!-- field notes section -->
                                <GridLayout
                                    order="2"
                                    rows="auto"
                                    columns="10*,55*,35*"
                                    v-if="isDeployed"
                                    class="m-t-5 m-b-10 m-x-10 p-10 bordered-container"
                                    @tap="goToFieldNotes"
                                >
                                    <Image col="0" width="25" src="~/images/Icon_FieldNotes.png"></Image>
                                    <Label col="1" :text="_L('fieldNotes')" class="size-16 m-l-10" verticalAlignment="middle" />
                                    <Label
                                        col="2"
                                        :text="percentComplete + '% ' + _L('complete')"
                                        class="size-16 blue"
                                        verticalAlignment="middle"
                                        v-if="percentComplete && percentComplete > 0"
                                    />
                                </GridLayout>
                                <!-- module list with current readings -->
                                <ModuleListView order="3" ref="moduleList" :station="currentStation" @moduleTapped="goToModule" />
                            </FlexboxLayout>
                        </GridLayout>
                        <!-- end background elements -->

                        <!-- foreground elements -->
                        <AbsoluteLayout row="0" col="0" class="text-center" v-if="newlyDeployed">
                            <!-- center dialog with grid layout -->
                            <GridLayout top="75" width="100%">
                                <StackLayout class="deployed-dialog-container">
                                    <Image width="60" src="~/images/Icon_Success.png"></Image>
                                    <Label :text="_L('stationDeployed')" class="deployed-dialog-text" />
                                </StackLayout>
                            </GridLayout>
                        </AbsoluteLayout>
                        <!-- end foreground elements -->
                    </GridLayout>
                </FlexboxLayout>
            </ScrollView>

            <!-- notifications -->
            <NotificationFooter row="1" :onClose="goToDetail" :notificationCodes="notificationCodes" v-if="notificationCodes.length > 0" />
            <!-- footer -->
            <ScreenFooter :row="notificationCodes.length > 0 ? '2' : '1'" active="stations" />
        </GridLayout>
    </Page>
</template>

<script>
import { BetterObservable } from "../services/rx";
import routes from "../routes";
import Services from "../services/services";
import Config from "../config";
import StationStatusBox from "./StationStatusBox";
import ModuleListView from "./ModuleListView";
import NotificationFooter from "./NotificationFooter";
import ScreenHeader from "./ScreenHeader";
import ScreenFooter from "./ScreenFooter";

const log = Config.logger("StationDetailView");

const dbInterface = Services.Database();

export default {
    data() {
        return {
            loading: true,
            isDeployed: false,
            deployedStatus: "",
            percentComplete: 0,
            modules: [],
            currentStation: { name: "", id: 0 },
            paramId: null,
            newlyDeployed: false,
            notificationCodes: [],
        };
    },
    components: {
        ScreenHeader,
        StationStatusBox,
        ModuleListView,
        NotificationFooter,
        ScreenFooter,
    },
    props: {
        stationId: {
            type: String,
        },
        station: {
            type: Object,
        },
        redirectedFromDeploy: {
            type: String,
        },
    },
    methods: {
        goBack(event) {
            // Change background color when pressed
            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            this.$navigateTo(routes.stations, {
                props: {
                    station: this.currentStation,
                },
                transition: {
                    name: "slideRight",
                    duration: 250,
                    curve: "linear",
                },
            });
        },

        goToDeploy(event) {
            this.$navigateTo(routes.deployMap, {
                props: {
                    station: this.currentStation,
                },
            });
        },

        goToFieldNotes() {
            this.$navigateTo(routes.deployNotes, {
                props: {
                    station: this.currentStation,
                    linkedFromStation: true,
                },
            });
        },

        goToModule(event) {
            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            this.$navigateTo(routes.module, {
                props: {
                    // remove the "m_id-" prefix
                    moduleId: event.object.id.split("m_id-")[1],
                    station: this.currentStation,
                },
            });
        },

        goToSettings(event) {
            // prevent taps before page finishes loading
            if (!this.currentStation || this.currentStation.id == 0) {
                return;
            }

            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            this.$navigateTo(routes.stationSettings, {
                props: {
                    station: this.currentStation,
                },
            });
        },

        goToDetail(event) {
            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            this.$navigateTo(routes.stationDetail, {
                props: {
                    station: this.currentStation,
                },
            });
        },

        stopProcesses() {
            if (this.currentStation && this.currentStation.url != "no_url") {
                this.$stationMonitor.stopLiveReadings(this.currentStation.url);
            }
            if (this.intervalTimer) {
                clearInterval(this.intervalTimer);
            }
            if (this.$refs.statusBox) {
                this.$refs.statusBox.stopProcesses();
            }
        },

        onPageLoaded(args) {
            console.log("loading station detail");

            this.page = args.object;

            this.user = this.$portalInterface.getCurrentUser();

            this.loadingBlue = this.page.getViewById("loading-circle-blue");
            this.loadingWhite = this.page.getViewById("loading-circle-white");
            this.intervalTimer = setInterval(this.showLoadingAnimation, 1000);

            this.stations = this.$stationMonitor.getStations();

            if (this.station) {
                this.currentStation = this.station;
                this.paramId = Number(this.currentStation.id);
                this.completeSetup();
            } else {
                this.paramId = this.stationId;
                this.getFromDatabase();
            }

            console.log("loaded station detail", this.paramId);
        },

        onUnloaded() {
            this.stopProcesses();
        },

        getFromDatabase() {
            dbInterface.getStation(this.paramId).then(this.getModules).then(this.setupModules).then(this.completeSetup);
        },

        respondToUpdates() {
            this.$stationMonitor.subscribe(stations => {
                if (!this.currentStation) {
                    console.log("view has no station");
                    return Promise.resolve();
                }

                const station = _(stations)
                    .filter(s => Number(s.id) == this.paramId)
                    .first();
                if (!station) {
                    return Promise.resolve();
                }

                this.currentStation.connected = station.connected;
                return dbInterface.getModules(this.paramId).then(this.setupModules).then(this.updateModules);
            });

            this.$stationMonitor.subscribe(stations => {
                const station = _(stations).filter(s => Number(s.id) == this.paramId);
                if (station.some()) {
                    this.$refs.statusBox.updateStatus(station.first());
                    this.$refs.moduleList.updateReadings(station.first().readings);
                }
            });
        },

        getModules(stations) {
            if (stations.length == 0) {
                // adding to db in background hasn't finished yet,
                // wait a few seconds and try again
                // jacob: This delay is kind of ugly, would love to remove this.
                return promiseAfter(2000).then(() => {
                    return this.getFromDatabase();
                });
            }
            this.currentStation = stations[0];
            // update via stationMonitor
            let listStation = this.stations.find(s => {
                return s.deviceId == this.currentStation.deviceId;
            });
            if (listStation) {
                this.currentStation.connected = listStation.connected;
            }
            return dbInterface.getModules(this.currentStation.id);
        },

        getSensors(moduleObject) {
            moduleObject.sensorObjects = [];
            return dbInterface.getSensors(moduleObject.deviceId).then(sensors => {
                moduleObject.sensorObjects = sensors;
            });
        },

        setupModules(modules) {
            this.currentStation.moduleObjects = modules;
            return Promise.all(this.currentStation.moduleObjects.map(this.getSensors)).catch(err => {
                console.log(`swallowing setupModules error ${err}`);
                return [];
            });
        },

        updateModules() {
            this.$refs.moduleList.updateModules(this.currentStation.moduleObjects);
        },

        completeSetup() {
            this.loading = false;
            clearInterval(this.intervalTimer);

            if (this.redirectedFromDeploy) {
                this.newlyDeployed = true;
                setTimeout(() => {
                    this.newlyDeployed = false;
                }, 3000);
            }

            if (this.currentStation.portalHttpError) {
                if (this.notificationCodes.indexOf(this.currentStation.portalHttpError == -1)) {
                    this.notificationCodes.push(this.currentStation.portalHttpError);
                }
            }

            if (this.currentStation.deployStartTime && typeof this.currentStation.deployStartTime == "string") {
                this.currentStation.deployStartTime = new Date(this.currentStation.deployStartTime);
            }
            if (this.currentStation.status == "recording") {
                this.setDeployedStatus();
                this.isDeployed = true;
                if (this.currentStation.percentComplete) {
                    this.percentComplete = this.currentStation.percentComplete;
                }
            } else {
                this.deployedStatus = _L("readyToDeploy");
            }
            this.$refs.statusBox.updateStation(this.currentStation);
            this.$refs.moduleList.updateModules(this.currentStation.moduleObjects);
            this.currentStation.origName = this.currentStation.name;

            // start getting live readings for this station
            if (this.currentStation.url != "no_url") {
                // see if live readings have been stored already
                const readings = this.$stationMonitor.getStationReadings(this.currentStation);
                if (readings) {
                    this.$refs.moduleList.updateReadings(readings);
                }
                this.$stationMonitor.startLiveReadings(this.currentStation.url);
            }

            // now that currentStation and modules are defined, respond to updates
            this.respondToUpdates();
        },

        setDeployedStatus() {
            if (!this.currentStation.deployStartTime) {
                this.deployedStatus = _L("deployed");
                return;
            }
            let month = this.currentStation.deployStartTime.getMonth() + 1;
            let day = this.currentStation.deployStartTime.getDate();
            let year = this.currentStation.deployStartTime.getFullYear();
            this.deployedStatus = _L("deployed") + " (" + month + "/" + day + "/" + year + ")";
        },

        showLoadingAnimation() {
            this.loadingWhite
                .animate({
                    rotate: 360,
                    duration: 975,
                })
                .then(() => {
                    this.loadingWhite.rotate = 0;
                });
        },
    },
};
</script>

<style scoped lang="scss">
// Start custom common variables
@import "../app-variables";
// End custom common variables

// Custom styles
#loading-circle-blue,
#loading-circle-white {
    width: 90;
    height: 90;
    background: $fk-gray-white;
    border-width: 2;
    border-radius: 60%;
}
#loading-circle-white {
    border-color: $fk-gray-white;
    clip-path: circle(100% at 50% 0);
}
#loading-circle-blue {
    border-color: $fk-secondary-blue;
}
.bordered-container {
    border-radius: 4;
    border-color: $fk-gray-lighter;
    border-width: 1;
}
.blue {
    color: $fk-primary-blue;
}

.deployed-dialog-container {
    border-radius: 4;
    background-color: $fk-gray-lightest;
    border-color: $fk-gray-lighter;
    border-width: 1;
    width: 225;
    height: 225;
    padding-top: 50;
}
.deployed-dialog-text {
    margin-top: 20;
    font-size: 18;
}
</style>
