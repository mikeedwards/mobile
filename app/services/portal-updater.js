export default class PortalUpdater {
    constructor(database, portalInterface) {
        console.log("PortalUpdater", "constructor");
        this.database = database;
        this.portalInterface = portalInterface;
    }

    start() {
        setInterval(() => this.addOrUpdateStations(), 60000);
        return Promise.resolve();
    }

    addOrUpdateStations() {
        return this.portalInterface.isAvailable().then((yes) => {
            if (!yes) {
                return Promise.resolve();
            }
            return this.database.getAll().then((stations) => {
                return Promise.all(
                    stations.map((station) => {
                        const params = {
                            name: station.name,
                            device_id: station.deviceId,
                            status_json: station,
                            status_pb: station.serializedStatus,
                        };
                        // update or add station
                        if (station.portalId) {
                            return this.portalInterface
                                .updateStation(params, station.portalId)
                                .then(() => {
                                    return this.database.setStationPortalError(station, "");
                                })
                                .catch((error) => {
                                    return this.database.setStationPortalError(station, error.response.status);
                                });
                        } else {
                            return this.portalInterface.addStation(params).then((result) => {
                                station.portalId = result.id;
                                this.database.setStationPortalId(station);
                            });
                        }
                    })
                );
            });
        });
    }
}
