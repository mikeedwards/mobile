import PortalInterface from "./portal-interface";

const portalInterface = new PortalInterface();

class Services {
    DiscoverStation() {
        if (!this.discoverStation) {
            const DiscoverStation = require("./discover-station").default;
            this.discoverStation = new DiscoverStation();
        }
        return this.discoverStation;
    }

    Database() {
        if (!this.database) {
            const DatabaseInterface = require("./db-interface").default;
            this.database = new DatabaseInterface();
        }
        return this.database;
    }

    QueryStation() {
        if (!this.queryStation) {
            const QueryStation = require("./query-station").default;
            this.queryStation = new QueryStation();
        }
        return this.queryStation;
    }

    StateManager() {
        if (!this.stateManager) {
            const StateManager = require("./state-manager").default;
            this.stateManager = new StateManager(this.Database(), this.QueryStation());
        }
        return this.stateManager;
    }

    StationMonitor() {
        if (!this.stationMonitor) {
            const StationMonitor = require("./station-monitor").default;
            this.stationMonitor = new StationMonitor(this.DiscoverStation(), this.Database(), this.QueryStation());
        }
        return this.stationMonitor;
    }

    CreateDb() {
        if (!this.createDb) {
            const CreateDb = require("./create-db").default;
            this.createDb = new CreateDb(this.Database());
        }
        return this.createDb;
    }

    PortalInterface() {
        return portalInterface;
    }
}

const services = new Services();

export default services;