<template>
    <Page class="page" actionBarHidden="true" @loaded="onPageLoaded">
        <GridLayout rows="*,140">
            <ScrollView row="0">
                <GridLayout rows="auto" columns="*" verticalAlignment="middle">
                    <StackLayout row="0" verticalAlignment="middle">
                        <GridLayout rows="*" columns="*">
                            <StackLayout row="0" verticalAlignment="middle">
                                <Image width="60" class="m-b-20" src="~/images/Icon_Soft_error.png" />
                                <Label class="title m-t-20 m-b-10 text-center" :text="step.title" textWrap="true"></Label>

                                <Label
                                    v-for="instruction in step.instructions"
                                    :key="instruction"
                                    class="instruction"
                                    :text="instruction"
                                    lineHeight="4"
                                    textWrap="true"
                                ></Label>
                            </StackLayout>
                        </GridLayout>
                    </StackLayout>
                </GridLayout>
            </ScrollView>

            <!-- sticky next button -->
            <StackLayout row="1" verticalAlignment="bottom" class="m-x-10">
                <Button
                    class="btn btn-primary btn-padded m-y-10"
                    :text="step.button"
                    :isEnabled="!step.buttonDisabled"
                    @tap="goNext"
                ></Button>
                <Label :text="step.altOption" class="skip" @tap="skip" textWrap="true" />
            </StackLayout>
            <!-- end sticky next button -->
        </GridLayout>
    </Page>
</template>

<script>
import routes from "../../routes";
import { _T } from "../../utilities";

export default {
    props: ["stepParam"],
    data() {
        return {
            step: {},
        };
    },
    components: {},
    methods: {
        onPageLoaded(args) {
            this.step = steps[this.stepParam];
        },

        goNext() {
            if (this.step.next && this.step.next == "goToStations") {
                this.goToStations();
                return;
            }

            if (this.step.next && this.step.next == "goToModuleAssembly") {
                this.goToModuleAssembly();
                return;
            }

            if (this.step.next && this.step.next == "testConnection") {
                this.goToTestConnection();
            }
        },

        skip() {
            if (this.step.skip && this.step.skip == "tryAgain") {
                this.goToTestConnection();
                return;
            }
            if (this.step.skip) {
                this.step.next = this.step.skip;
            }
            if (this.step.next) {
                this.goNext();
            } else {
                this.$navigateTo(routes.stations);
            }
        },

        goToStations() {
            this.$navigateTo(routes.stations, {
                clearHistory: true,
                backstackVisible: false,
            });
        },

        goToModuleAssembly() {
            this.$navigateTo(routes.assembleStation, {
                props: {
                    stepParam: 3,
                },
            });
        },

        goToTestConnection() {
            this.$navigateTo(routes.connectStation, {
                props: {
                    stepParam: "testConnection",
                },
            });
        },
    },
};
import * as i18n from "tns-i18n";
// Note: i18n detects the preferred language on the phone,
// and this default language initialization does not override that
i18n("en");

const steps = {
    trouble: {
        prev: "",
        next: "testConnection",
        title: _L("havingProblems"),
        skip: "goToStations",
        instructions: ["1. " + _L("problemStep1"), "2. " + _L("problemStep2"), "3. " + _L("problemStep3")],
        button: _L("tryAgain"),
        images: [],
        altOption: _L("skipStep"),
    },
    testConnection: {
        prev: "",
        next: "",
        proceed: "selectStation",
        title: "",
        instructions: [_L("connecting")],
        button: "",
        images: [],
    },
    noModules: {
        prev: "startCalibration",
        next: "goToModuleAssembly",
        skip: "goToStations",
        title: _L("noModulesConnected"),
        instructions: [_L("noModulesInstruction")],
        button: _L("addModules"),
        images: [],
        altOption: _L("continueWithoutModules"),
    },
};
</script>

<style scoped lang="scss">
// Start custom common variables
@import "../../app-variables";
// End custom common variables
// Custom styles
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
.option-container {
    margin-top: 30;
    margin-left: 30;
    margin-right: 30;
}
.radio-info {
    color: $fk-gray-hint;
    margin-top: 10;
    margin-bottom: 20;
    margin-left: 35;
}
.input {
    width: 90%;
    margin-left: 20;
    margin-right: 20;
    border-bottom-width: 1px;
    text-align: center;
}
.small {
    width: 50;
    margin: 20;
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
