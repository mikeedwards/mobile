<template>
    <Page class="page" actionBarHidden="true" @loaded="onPageLoaded">
        <GridLayout rows="140,*,140">
            <!-- header section -->
            <GridLayout row="0" rows="auto, auto" columns="*" class="m-y-20">
                <StackLayout row="0" verticalAlignment="middle">
                    <Label class="title text-center" :text="step.title" textWrap="true"></Label>
                </StackLayout>
                <!-- calibration progress image -->
                <GridLayout row="1" rows="auto, auto" columns="*,*" width="80%" class="m-t-10 m-b-20">
                    <Image row="0" colSpan="2" class="m-b-10 m-l-15 m-r-15" :src="progressImage" />
                    <Label row="1" col="0" horizontalAlignment="left" :text="_L('connect')" />
                    <Label row="1" col="1" horizontalAlignment="right" :text="_L('setup')" />
                </GridLayout>
                <!-- end calibration progress image -->
            </GridLayout>
            <!-- end header section -->

            <ScrollView row="1">
                <GridLayout rows="*" columns="*">
                    <StackLayout row="0" verticalAlignment="middle">
                        <Label
                            v-for="instruction in step.instructions"
                            :key="instruction"
                            class="instruction"
                            :text="instruction"
                            lineHeight="4"
                            textWrap="true"
                        ></Label>

                        <!-- module list -->
                        <StackLayout class="m-t-10"></StackLayout>
                        <GridLayout rows="auto" columns="*" class="m-t-10 m-x-20" v-for="(m, moduleIndex) in modules" :key="m.id">
                            <StackLayout class="bordered-container p-10" @tap="goToCalibration(m)">
                                <GridLayout rows="auto, auto" columns="15*,70*,15*">
                                    <!-- module icon -->
                                    <Image rowSpan="2" col="0" width="40" horizontalAlignment="left" :src="getModuleImage(m)"></Image>
                                    <!-- module name -->
                                    <Label
                                        row="0"
                                        col="1"
                                        :rowSpan="m.calibratedLabel ? '1' : '2'"
                                        :text="getModuleName(m)"
                                        verticalAlignment="middle"
                                        class="size-18"
                                        textWrap="true"
                                    />
                                    <!-- calibration status -->
                                    <Label row="1" col="1" :text="m.calibratedLabel" :class="'size-14 ' + m.calibratedClass" />
                                    <!-- calibration check mark -->
                                    <Image rowSpan="2" col="2" width="20" horizontalAlignment="right" :src="m.calibratedImage"></Image>
                                </GridLayout>
                            </StackLayout>
                        </GridLayout>
                        <!-- end module list -->
                    </StackLayout>
                </GridLayout>
            </ScrollView>

            <!-- sticky next button -->
            <StackLayout row="2" verticalAlignment="bottom" class="m-x-10">
                <Button
                    class="btn btn-primary btn-padded m-y-10"
                    :text="step.button"
                    :isEnabled="!step.buttonDisabled"
                    @tap="goToStations"
                ></Button>
                <Label :text="step.altOption" class="skip" @tap="goToStations" textWrap="true" />
            </StackLayout>
            <!-- end sticky next button -->

            <!-- loading screen -->
            <StackLayout row="0" rowSpan="3" v-if="loading" height="100%" backgroundColor="white" verticalAlignment="middle">
                <GridLayout rows="auto, auto" columns="*">
                    <StackLayout row="0" id="loading-circle-blue"></StackLayout>
                    <StackLayout row="0" id="loading-circle-white"></StackLayout>
                    <Label row="1" class="instruction m-t-20" :text="_L('fetchingStationInfo')" lineHeight="4" textWrap="true"></Label>
                </GridLayout>
            </StackLayout>
            <!-- end loading screen -->
        </GridLayout>
    </Page>
</template>

<script>
import routes from "../../routes";
import { _T, convertOldFirmwareResponse } from "../../utilities";
import Services from "../../services/services";
import AppSettings from "../../wrappers/app-settings";
import ConnectStationError from "./ConnectStationError";

const dbInterface = Services.Database();
const calibrationService = Services.CalibrationService();
const sensorsThatCalibrate = ["ph", "do", "ec"];

export default {
    props: ["stepParam", "stationParam"],
    data() {
        return {
            step: {},
            loading: true,
            modules: [],
            pending: {},
            progressImage: null,
        };
    },
    components: {
        ConnectStationError,
    },
    methods: {
        onPageLoaded(args) {
            this.page = args.object;
            this.loadingWhite = this.page.getViewById("loading-circle-white");
            if (this.loadingWhite) {
                this.loadingWhite.animate({
                    rotate: 360,
                    duration: 1000,
                });
            }
            this.loadingTimer = setInterval(this.showSpinner, 1000);

            this._appSettings = new AppSettings();

            if (this.stationParam) {
                this.station = this.stationParam;
                this.fetchModules()
                    .then(this.setupModules)
                    .then(this.completeSetup);
            }
        },

        stopAnimation() {
            this.loadingWhite = null;
            clearInterval(this.loadingTimer);
            this.loadingTimer = null;
        },

        showSpinner() {
            if (this.loadingWhite) {
                this.loadingWhite.rotate = 0;
                this.loadingWhite.animate({
                    rotate: 360,
                    duration: 1000,
                });
            }
        },

        goToStations() {
            this.stopAnimation();
            this.$navigateTo(routes.stations, {
                clearHistory: true,
                backstackVisible: false,
            });
        },

        fetchModules() {
            return dbInterface.getModules(this.station.id);
        },

        getSensors(moduleObject) {
            return dbInterface.getSensors(moduleObject.deviceId).then(sensors => {
                moduleObject.sensorObjects = sensors;
            });
        },

        setupModules(modules) {
            this.station.moduleObjects = modules;
            return Promise.all(this.station.moduleObjects.map(this.getSensors));
        },

        completeSetup() {
            if (this.modules.length == 0) {
                this.updateModules(this.station.moduleObjects);
            }
        },

        assessCalibration() {
            const toCalibrate = this.modules.filter(m => {
                return !m.calibratedLabel || m.calibratedLabel == _L("uncalibrated");
            });
            if (toCalibrate.length == 0) {
                this.recordCompletion();
                this.step = steps.endCalibration;
            } else {
                this.step = steps[this.stepParam];
            }
            this.step.title = this.station.name;
            this.progressImage = this.step.progressImage;
        },

        goToCalibration(m) {
            if (m.calibratedLabel != _L("uncalibrated")) {
                return;
            }

            this.stopAnimation();
            // navigate to calibration
            this.$navigateTo(routes.calibration, {
                clearHistory: true,
                backstackVisible: false,
                props: {
                    station: this.station,
                    type: m.calibrateSensor,
                    onboarding: true,
                },
            });
        },

        recordCompletion() {
            this._appSettings.setString("completedSetup", "true");
        },

        updateModules(modules) {
            this.modules = modules.sort((a, b) => {
                return b.position < a.position ? 1 : b.position > a.position ? -1 : 0;
            });
            if (this.modules.length == 0) {
                this.$navigateTo(ConnectStationError, {
                    props: {
                        stepParam: "noModules",
                    },
                });
                return;
            }

            this.sensorsChecked = 0;
            this.totalSensors = _.sumBy(this.modules, m => {
                return m.sensorObjects.length;
            });
            this.modules.forEach((m, i) => {
                m.calibratedLabel = null;
                m.calibratedClass = "gray-text";
                m.calibratedImage = "";
                m.sensorObjects.forEach(s => {
                    this.checkCalibrationStatus(m, i, s);
                });
            });
        },

        checkCalibrationStatus(m, i, s) {
            if (
                (m.position || m.position == 0) &&
                this.station.url &&
                !this.pending[m.position] &&
                sensorsThatCalibrate.indexOf(s.name) > -1
            ) {
                m.calibrateSensor = s.name;
                // keep track so many requests aren't sent at once
                this.pending[m.position] = true;
                const connectView = this;
                setTimeout(() => {
                    calibrationService.getCalibrationStatus(this.station.url + "/module/" + m.position).then(result => {
                        connectView.sensorsChecked += 1;
                        connectView.handleCalibrationResult(result, m, s.name);
                    });
                }, i * 1000);
            } else if (this.pending[m.position]) {
                // check to see if it even needs calibration
                // as ec sets m.position to pending, but tds and salinity, in same position,
                // don't need calibration
                if (sensorsThatCalibrate.indexOf(s.name) == -1) {
                    this.sensorsChecked += 1;
                }
            } else if (!this.pending[m.position]) {
                m.calibratedLabel = _L("noCalibrationNeeded");
                m.calibratedImage = "~/images/Icon_Success.png";
                this.sensorsChecked += 1;
            }
            if (this.sensorsChecked >= this.totalSensors) {
                this.endModuleCheck();
            }
        },

        handleCalibrationResult(result, m, sensorName) {
            let total = 0;
            if (sensorName == "ph") {
                if (result.calibration.phStatus) {
                    total = _.sum(_.values(result.calibration.phStatus));
                }
            }
            if (sensorName == "do") {
                if (result.calibration.doStatus) {
                    total = _.sum(_.values(result.calibration.doStatus));
                }
            }
            if (sensorName == "ec") {
                if (result.calibration.ecStatus) {
                    total = _.sum(_.values(result.calibration.ecStatus));
                }
            }
            m.calibratedLabel = total > 0 ? _L("calibrated") : _L("uncalibrated");
            m.calibratedClass = total > 0 ? "gray-text" : "red-text";
            m.calibratedImage = total > 0 ? "~/images/Icon_Success.png" : "";
            this.pending[m.position] = false;
            if (this.sensorsChecked >= this.totalSensors) {
                this.endModuleCheck();
            }
        },

        endModuleCheck() {
            this.assessCalibration();
            clearInterval(this.loadingTimer);
            this.loading = false;
        },

        getModuleImage(module) {
            switch (module.name) {
                case "modules.distance":
                    return "~/images/Icon_Distance_Module.png";
                    break;
                case "modules.weather":
                    return "~/images/Icon_Weather_Module.png ";
                    break;
                case "modules.water.ec":
                    return "~/images/Icon_WaterConductivity_Module.png";
                    break;
                case "modules.water.ph":
                    return "~/images/Icon_WaterpH_Module.png";
                    break;
                case "modules.water.do":
                    return "~/images/Icon_DissolvedOxygen_Module.png";
                    break;
                case "modules.water.temp":
                    return "~/images/Icon_WaterTemp_Module.png";
                    break;
                case "modules.water.orp":
                    return "~/images/Icon_Water_Module.png";
                    break;
                case "modules.water.unknown":
                    return "~/images/Icon_Water_Module.png";
                    break;
                default:
                    return "~/images/Icon_Generic_Module.png";
                    break;
            }
        },

        getModuleName(module) {
            const newName = convertOldFirmwareResponse(module);
            return _T(newName + ".name");
        },
    },
};
import * as i18n from "tns-i18n";
// Note: i18n detects the preferred language on the phone,
// and this default language initialization does not override that
i18n("en");

const steps = {
    startCalibration: {
        showingModules: true,
        prev: "",
        next: "",
        hasHeading: false,
        title: "",
        instructions: [_L("startCalibrationStep1"), _L("startCalibrationStep2")],
        button: _L("done"),
        buttonDisabled: true,
        images: [],
        progressImage: "~/images/Icon_incomplete.png",
        altOption: _L("setupLater"),
    },
    endCalibration: {
        showingModules: true,
        prev: "",
        next: "goToStations",
        hasHeading: false,
        title: "",
        instructions: [_L("endCalibrationStep")],
        button: _L("done"),
        images: [],
        progressImage: "~/images/Icon_complete.png",
    },
};
</script>

<style scoped lang="scss">
// Start custom common variables
@import "../../app-variables";
// End custom common variables
// Custom styles
#loading-circle-blue,
#loading-circle-white {
    width: 75;
    height: 75;
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

.skip {
    padding-top: 10;
    padding-bottom: 10;
    background-color: white;
    font-size: 14;
    font-weight: bold;
    text-align: center;
    margin: 10;
}
.instruction {
    color: $fk-primary-black;
    text-align: center;
    font-size: 16;
    margin-top: 5;
    margin-bottom: 10;
    margin-right: 30;
    margin-left: 30;
}

.bordered-container {
    border-radius: 4;
    border-color: $fk-gray-lighter;
    border-width: 1;
}

.gray-text {
    color: $fk-gray-hint;
}
.red-text {
    color: $fk-primary-red;
}
</style>
