<template>
    <Page class="page plain" actionBarHidden="true" @loaded="onPageLoaded">
        <GridLayout :rows="station.connected ? (ios ? '68,*,80' : '78,*,80') : '105,*,80'">
            <StackLayout row="0">
                <ScreenHeader
                    :title="viewTitle"
                    :subtitle="station.name"
                    :canNavigateBack="false"
                    :canCancel="true"
                    :onCancel="onNavCancel"
                    :canNavigateSettings="false"
                />
                <GridLayout rows="auto" columns="33*,33*,34*" class="top-line-bkgd">
                    <StackLayout col="0" class="top-line"></StackLayout>
                </GridLayout>
                <StackLayout class="text-center disconnect-warning" v-if="!station.connected">
                    <Label :text="_L('stationDisconnected')" />
                </StackLayout>
            </StackLayout>

            <ScrollView row="1">
                <FlexboxLayout flexDirection="column" justifyContent="space-between">
                    <StackLayout>
                        <Mapbox
                            :accessToken="mapboxToken"
                            automationText="currentLocationMap"
                            mapStyle="mapbox://styles/mapbox/outdoors-v11"
                            height="150"
                            hideCompass="false"
                            zoomLevel="0"
                            showUserLocation="false"
                            disableZoom="false"
                            disableRotation="false"
                            disableScroll="false"
                            disableTilt="false"
                            @mapReady="onMapReady"
                        ></Mapbox>
                    </StackLayout>

                    <!-- Name your location -->
                    <GridLayout rows="*" columns="*" class="m-t-30 m-b-20 m-x-10">
                        <StackLayout row="0">
                            <GridLayout rows="auto,auto" columns="*">
                                <Label
                                    row="0"
                                    id="hidden-instruction"
                                    :text="_L('nameYourLocation')"
                                    class="size-12"
                                    :visibility="typing ? 'visible' : 'collapsed'"
                                />
                                <TextField
                                    row="1"
                                    :class="'input ' + lineStatus"
                                    id="location-name-field"
                                    :hint="_L('nameYourLocation')"
                                    keyboardType="name"
                                    autocorrect="false"
                                    autocapitalizationType="none"
                                    v-model="station.locationName"
                                    @focus="changeLineStatus"
                                    @textChange="showInstruction"
                                    @blur="checkLocationName"
                                ></TextField>
                            </GridLayout>
                            <Label
                                class="validation-error"
                                id="no-location"
                                horizontalAlignment="left"
                                :text="_L('locationRequired')"
                                textWrap="true"
                                :visibility="noLocation ? 'visible' : 'collapsed'"
                            ></Label>
                            <Label
                                class="validation-error"
                                id="location-too-long"
                                horizontalAlignment="left"
                                :text="_L('locationOver255')"
                                textWrap="true"
                                :visibility="locationTooLong ? 'visible' : 'collapsed'"
                            ></Label>
                            <Label
                                class="validation-error"
                                id="location-not-printable"
                                horizontalAlignment="left"
                                :text="_L('locationNotPrintable')"
                                textWrap="true"
                                :visibility="locationNotPrintable ? 'visible' : 'collapsed'"
                            ></Label>
                        </StackLayout>
                    </GridLayout>
                    <!-- end: Name your location -->

                    <!-- Data capture interval -->
                    <ConfigureCaptureInterval :station="station" ref="configCaptureInterval" />
                    <!-- end: Data capture interval -->
                    <TextView id="hidden-field" />
                </FlexboxLayout>
            </ScrollView>

            <!-- sticky continue button -->
            <StackLayout row="2">
                <Button
                    class="btn btn-primary btn-padded m-b-10"
                    :text="_L('continue')"
                    automationText="nextButton"
                    @tap="goToNext"
                ></Button>
            </StackLayout>
        </GridLayout>
    </Page>
</template>

<script>
import { isIOS } from "tns-core-modules/platform";
import { AnimationCurve } from "tns-core-modules/ui/enums";
import { MAPBOX_ACCESS_TOKEN } from "../secrets";
import ScreenHeader from "./ScreenHeader";
import ConfigureCaptureInterval from "./ConfigureCaptureInterval";
import Services from "../services/services";
import routes from "../routes";

const dbInterface = Services.Database();

export default {
    data() {
        return {
            ios: isIOS,
            viewTitle: _L("deployment"),
            mapboxToken: MAPBOX_ACCESS_TOKEN,
            origLocationName: "",
            noLocation: false,
            locationNotPrintable: false,
            locationTooLong: false,
            origLatitude: "",
            origLongitude: "",
            typing: false,
            lineStatus: "inactive-line",
        };
    },
    props: ["station"],
    components: {
        ScreenHeader,
        ConfigureCaptureInterval,
    },
    methods: {
        onPageLoaded(args) {
            this.page = args.object;

            let user = this.$portalInterface.getCurrentUser();
            this.userName = user.name;

            this.hiddenInstruction = this.page.getViewById("hidden-instruction");

            this.saveOriginalValues();
        },

        onMapReady(args) {
            this.map = args.map;
            this.displayStation();
        },

        goBack(event) {
            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            this.$navigateTo(routes.stationDetail, {
                props: {
                    station: this.station,
                },
                transition: {
                    name: "slideRight",
                    duration: 250,
                    curve: "linear",
                },
            });
        },

        goToNext(event) {
            this.saveLocationName();

            if (this.$refs.configCaptureInterval.checkAllIntervals()) {
                this.$navigateTo(routes.deployNotes, {
                    props: {
                        station: this.station,
                    },
                });
            }
        },

        onNavCancel(event) {
            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            this.$navigateTo(routes.stationDetail, {
                props: {
                    stationId: this.station.id,
                    station: this.station,
                },
            });
        },

        saveOriginalValues() {
            if (!this.station.locationName) {
                this.station.locationName = "";
            }
            this.origLocationName = this.station.locationName;
            this.origLatitude = this.station.latitude;
            this.origLongitude = this.station.longitude;
        },

        displayStation() {
            if (this.station.latitude && this.station.longitude && this.station.latitude != 1000 && this.station.longitude != 1000) {
                this.map.setCenter({
                    lat: this.station.latitude,
                    lng: this.station.longitude,
                    animated: false,
                });
                this.map.setZoomLevel({
                    level: 14,
                    // animated: true
                });
                this.mapMarker = {
                    lat: this.station.latitude,
                    lng: this.station.longitude,
                    title: this.station.name,
                    subtitle: _L("readyToDeploy"),
                    iconPath: "images/Icon_Map_Dot.png",
                };
                this.map.addMarkers([this.mapMarker]);
            }
        },

        changeLineStatus() {
            this.lineStatus = "active-line";
        },

        showInstruction() {
            if (!this.typing && this.station.locationName) {
                this.animateText(this.hiddenInstruction);
            } else if (!this.station.locationName) {
                this.typing = false;
            }
        },

        animateText(element) {
            element.opacity = 0;
            element.translateX = 5;
            element.translateY = 20;
            this.typing = true;
            element.animate({
                opacity: 0.75,
                translate: { x: 0, y: 0 },
                duration: 300,
                curve: AnimationCurve.easeIn,
            });
        },

        checkLocationName() {
            this.typing = false;
            this.lineStatus = "inactive-line";
            // not sure yet what location name validation we'll do
            return true;
            // this.noLocation = false;
            // this.noLocation = !this.station.locationName || this.station.locationName.length == 0;
            // return !this.noLocation;
        },

        saveLocationName() {
            this.removeFocus("location-name-field");

            let valid = this.checkLocationName();
            if (valid && this.origLocationName != this.station.locationName) {
                // send location name as field note to portal
                let portalParams = {
                    stationId: this.station.portalId,
                    created: new Date(),
                    category_id: 2,
                    note: this.station.locationName,
                };
                this.$portalInterface.addFieldNote(portalParams);

                if (this.mapMarker) {
                    this.mapMarker.update({ title: this.station.locationName });
                }
                dbInterface.setStationLocationName(this.station);
                let configChange = {
                    stationId: this.station.id,
                    before: this.origLocationName,
                    after: this.station.locationName,
                    affectedField: "location",
                    author: this.userName,
                };
                dbInterface.recordStationConfigChange(configChange);
                this.origLocationName = this.station.locationName;
            }
        },

        removeFocus(id) {
            let textField = this.page.getViewById(id);
            textField.dismissSoftInput();

            let hiddenField = this.page.getViewById("hidden-field");
            hiddenField.focus();
            hiddenField.dismissSoftInput();
        },
    },
};
</script>

<style scoped lang="scss">
// Start custom common variables
@import "../app-variables";
// End custom common variables

// Custom styles
.top-line-bkgd {
    background-color: $fk-gray-lighter;
}
.top-line {
    border-bottom-width: 3;
    border-bottom-color: $fk-primary-blue;
}

#location-name-field {
    color: $fk-primary-black;
    padding-bottom: 5;
    width: 100%;
    font-size: 18;
}
#hidden-instruction {
    color: $fk-gray-hint;
}

.inactive-line {
    border-bottom-color: $fk-gray-lighter;
    border-bottom-width: 1;
}
.active-line {
    border-bottom-color: $fk-secondary-blue;
    border-bottom-width: 2;
}
.validation-error {
    width: 100%;
    font-size: 12;
    color: $fk-tertiary-red;
    border-top-color: $fk-tertiary-red;
    border-top-width: 2;
    padding-top: 5;
}

#hidden-field {
    opacity: 0;
}
</style>
