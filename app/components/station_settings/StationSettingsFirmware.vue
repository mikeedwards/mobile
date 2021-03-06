<template>
    <Page class="page" actionBarHidden="true" @loaded="onPageLoaded">
        <GridLayout rows="*,70">
            <ScrollView row="0">
                <FlexboxLayout flexDirection="column" justifyContent="space-between" class="p-t-10">
                    <ScreenHeader :title="_L('firmware')" :subtitle="station.name" :onBack="goBack" :canNavigateSettings="false" />

                    <StackLayout class="m-t-10 m-b-30">
                        <Label :text="_L('stationFirmwareVersion')" class="size-20 m-x-15" />
                        <Label
                            :text="_L('firmwareNumber') + ': ' + versions.firmwareNumber"
                            class="size-15 m-x-15 m-b-20"
                            textWrap="true"
                        />
                        <Label :text="_L('appFirmwareVersion')" class="size-20 m-x-15" />
                        <Label :text="_L('firmwareNumber') + ': ' + appDownloaded" class="size-15 m-x-15 m-b-20" textWrap="true" />

                        <Button
                            v-if="updateAvailable"
                            :text="_L('upgradeFirmware')"
                            :isEnabled="station.connected"
                            @tap="upgradeFirmware"
                            class="btn btn-primary btn-padded"
                        ></Button>
                        <Label v-else :text="_L('upToDate')" class="size-20 m-x-15 bottom-border" />
                        <ConnectionNote v-if="updateAvailable" :station="station" />
                    </StackLayout>

                    <WrapLayout orientation="horizontal" class="m-10 m-b-20">
                        <Label :text="_L('additionalInfo')" class="size-16 full-width" textWrap="true" />
                        <Label :text="_L('firmware') + ': ' + versions.firmware" class="size-14 full-width m-t-10" textWrap="true" />
                        <Label :text="_L('firmwareBuild') + ': ' + versions.firmwareBuild" class="size-14 full-width" textWrap="true" />
                        <Label :text="_L('deviceId') + ': ' + versions.device" class="size-14 full-width" textWrap="true" />
                    </WrapLayout>
                </FlexboxLayout>
            </ScrollView>

            <ScreenFooter row="1" :station="station" active="stations" />
        </GridLayout>
    </Page>
</template>

<script>
import routes from "../../routes";
import { hexStringToByteWiseString } from "../../utilities";
import Services from "../../services/services";

import ScreenHeader from "../ScreenHeader";
import ScreenFooter from "../ScreenFooter";
import UpgradeFirmwareModal from "./UpgradeFirmwareModal";
import ConnectionNote from "./StationSettingsConnectionNote";

const dbInterface = Services.Database();

export default {
    data() {
        return {
            versions: {
                firmware: "1.0",
                firmwareBuild: "1.0",
                firmwareNumber: "--",
                device: "1.0",
            },
            updateAvailable: true,
            appDownloaded: "--",
        };
    },
    props: ["station"],
    components: {
        ScreenHeader,
        ScreenFooter,
        ConnectionNote,
    },
    methods: {
        onPageLoaded(args) {
            this.page = args.object;

            let deviceStatus = this.station.statusJson;
            if (deviceStatus && deviceStatus.status.identity) {
                if (deviceStatus.status.identity.deviceId) {
                    this.versions.device = hexStringToByteWiseString(deviceStatus.status.identity.deviceId);
                }
                if (deviceStatus.status.firmware) {
                    // newer firmware
                    this.versions.firmware = hexStringToByteWiseString(deviceStatus.status.firmware.hash);
                    this.versions.firmwareBuild = deviceStatus.status.firmware.build;
                    this.versions.firmwareNumber = deviceStatus.status.firmware.number;
                } else if (deviceStatus.status.identity.firmware) {
                    this.versions.firmware = hexStringToByteWiseString(deviceStatus.status.identity.firmware);
                    let chunks = deviceStatus.status.identity.build.split("_");
                    this.versions.firmwareBuild = chunks[chunks.length - 2] + "_" + chunks[chunks.length - 1];
                }
                // compare downloaded version
                dbInterface.getLatestFirmware().then(latest => {
                    this.appDownloaded = latest.buildNumber;
                    this.updateAvailable = latest.buildTime > deviceStatus.status.firmware.timestamp;
                });
            }
            this.deviceStatus = deviceStatus;
        },

        downloadFirmware(args) {
            const options = {
                props: {
                    station: this.station,
                    downloadOnly: true,
                },
                fullscreen: true,
            };
            this.$showModal(UpgradeFirmwareModal, options);
        },

        upgradeFirmware(args) {
            const options = {
                props: {
                    station: this.station,
                    downloadOnly: false,
                },
                fullscreen: true,
            };
            this.$showModal(UpgradeFirmwareModal, options);
        },

        goBack(event) {
            // Change background color when pressed
            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            this.$navigateTo(routes.stationSettings, {
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
    },
};
</script>

<style scoped lang="scss">
// Start custom common variables
@import "../../app-variables";
// End custom common variables

// Custom styles
.bottom-border {
    border-bottom-color: $fk-gray-lighter;
    border-bottom-width: 1;
}

.section-border {
    margin: 10;
    border-bottom-color: $fk-gray-lightest;
    border-bottom-width: 2;
}

.lighter {
    color: $fk-gray-text;
}

.full-width {
    width: 100%;
    margin-bottom: 10;
}
</style>
