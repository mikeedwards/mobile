<template>
    <Page class="page" actionBarHidden="true" @loaded="onPageLoaded">
        <GridLayout rows="*,70">
            <ScrollView row="0">
                <StackLayout class="p-t-10">
                    <ScreenHeader :title="_L('general')" :subtitle="station.name" :onBack="goBack" :canNavigateSettings="false" />

                    <!-- menu -->
                    <StackLayout class="m-t-5">
                        <Label
                            v-for="(option, i) in menuOptions"
                            :key="option"
                            :class="'menu-text size-18 ' + (i == menuOptions.length - 1 ? 'bottom-border' : '')"
                            :text="option"
                            textWrap="true"
                            @tap="selectFromMenu"
                        ></Label>
                    </StackLayout>
                </StackLayout>
            </ScrollView>

            <ScreenFooter row="1" :station="station" active="stations" />
        </GridLayout>
    </Page>
</template>

<script>
import routes from "../../routes";
import Services from "../../services/services";

import ScreenHeader from "../ScreenHeader";
import ScreenFooter from "../ScreenFooter";
import StationName from "./StationSettingsName";
import CaptureSchedule from "./StationSettingsCaptureSchedule";

export default {
    data() {
        return {
            menuOptions: [_L("stationName"), _L("dataCaptureSchedule")],
        };
    },
    props: ["station"],
    components: {
        ScreenHeader,
        ScreenFooter,
        StationName,
        CaptureSchedule,
    },
    methods: {
        onPageLoaded(args) {},

        selectFromMenu(event) {
            let cn = event.object.className;
            event.object.className = cn + " pressed";
            setTimeout(() => {
                event.object.className = cn;
            }, 500);

            switch (event.object.text) {
                case _L("stationName"):
                    this.goToName();
                    break;
                case _L("dataCaptureSchedule"):
                    this.goToSchedule();
                    break;
            }
        },

        goToName() {
            this.$navigateTo(StationName, {
                props: {
                    station: this.station,
                },
            });
        },

        goToSchedule() {
            this.$navigateTo(CaptureSchedule, {
                props: {
                    station: this.station,
                },
            });
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
.menu-text {
    padding-left: 5;
    padding-top: 20;
    padding-bottom: 20;
    margin-left: 10;
    margin-right: 10;
    border-color: $fk-gray-lighter;
    border-top-width: 1;
}
.bottom-border {
    border-bottom-color: $fk-gray-lighter;
    border-bottom-width: 1;
}
</style>
