import AppSettings from "../components/AppSettingsView";
import AssembleStation from "../components/onboarding/AssembleStationView";
import Calibration from "../components/CalibrationView";
import ConfigureModule from "../components/unused/ConfigureModuleView";
import ConnectStation from "../components/onboarding/ConnectStationView";
import DataSync from "../components/DataSyncView";
import DeployMap from "../components/DeployMapView";
import DeployNotes from "../components/DeployNotesView";
import DeployReview from "../components/DeployReviewView";
import DeveloperMenu from "../components/DeveloperMenuView";
import Login from "../components/LoginView";
import Module from "../components/ModuleDetailView";
import StationDetail from "../components/StationDetailView";
import Stations from "../components/StationListView";
import StationSettings from "../components/station_settings/StationSettingsView";

const routes = {
    appSettings: AppSettings,
    calibration: Calibration,
    configureModule: ConfigureModule,
    connectStation: ConnectStation,
    dataSync: DataSync,
    deployMap: DeployMap,
    deployNotes: DeployNotes,
    deployReview: DeployReview,
    developerMenu: DeveloperMenu,
    login: Login,
    module: Module,
    assembleStation: AssembleStation,
    stationDetail: StationDetail,
    stations: Stations,
    stationSettings: StationSettings,
};

export default routes;
