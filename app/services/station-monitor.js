import _ from "lodash";
import { BetterObservable } from "./rx";
import { promiseAfter, convertBytesToLabel } from "../utilities";
import { Coordinates, Phone, KnownStations } from "./known-stations";
import Services from "./services";
import StationLogs from "./station-logs";
import Config from "../config";

const log = Config.logger("StationMonitor");
const pastDate = new Date(2000, 0, 1);

function is_internal_module(module) {
    return !Config.includeInternalModules && module.flags & 1; // TODO Pull this enum in from the protobuf file.
}

function is_internal_sensor(sensor) {
    return !Config.includeInternalSensors && sensor.flags & 1; // TODO Pull this enum in from the protobuf file.
}

export default class StationMonitor extends BetterObservable {
    constructor(discoverStation, dbInterface, queryStation, phoneLocation) {
        super();

        log.info("StationMonitor ctor");

        this.dbInterface = dbInterface;
        this.queryStation = queryStation;
        this.phoneLocation = phoneLocation;
        this.discoverStation = discoverStation;
        this.stations = {};
        // stations whose details are being viewed in app are "active"
        this.activeAddresses = [];
        this.queriesInProgress = {};
        this.logs = new StationLogs(discoverStation, queryStation);
        this.phone = new Phone();
        this.knownStations = new KnownStations();

        // temporary method to clear out modules with no device ids (is this still necessary?)
        this.dbInterface.removeNullIdModules().then(() => this.dbInterface.getAll().then(stations => this.initializeStations(stations)));

        // start getting updates about which stations are nearby.
        this.subscribeToStationDiscovery();

        // Get the phone's location right away and then subscribe to
        // any updates to the phone's location and pass them over to
        // update any stations that may need updating.
        this.phoneLocation
            .enableAndGetLocation()
            .then(location => this.savePhoneLocation(location))
            .then(() => this.phoneLocation.subscribe(location => this.savePhoneLocation(location)));
    }

    getPhone() {
        return Promise.resolve(this.phone);
    }

    getKnownStations() {
        return Promise.resolve(this.knownStations);
    }

    clearStations() {
        this.stations = {};
        this.activeAddresses = [];
    }

    savePhoneLocation(location) {
        log.info("new phone location", location);

        this.phone.location = new Coordinates(location);

        return Promise.all(
            Object.values(this.stations).map(station => {
                return this.knownStations.get(station).haveNewPhoneLocation(this.phone);
            })
        );
    }

    initializeStations(result) {
        const thisMonitor = this;
        result.map(r => {
            r.lastSeen = pastDate;
            // not getting connected from db anymore
            // all are disconnected until discovered
            r.connected = false;
            thisMonitor.stations[r.deviceId] = r;
        });
    }

    getStations() {
        return this.sortStations();
    }

    getStationReadings(station) {
        return this.stations[station.deviceId] ? this.stations[station.deviceId].readings : null;
    }

    _requestInitialReadings(station) {
        if (!station.connected) {
            return Promise.resolve();
        }

        if (this.queriesInProgress[station.deviceId]) {
            return Promise.resolve();
        }

        // take readings first so they can be stored (active or not)
        return this._requestStationData(station, true);
    }

    // take readings, if active, otherwise query status
    _statusOrReadings(station, takeReadings) {
        if (takeReadings || this.activeAddresses.indexOf(station.url) > -1) {
            return this.queryStation.takeReadings(station.url).then(status => {
                return this.updateStationReadings(station, status);
            });
        }

        const updated = station.updated ? new Date(station.updated).getTime() : Date.now();
        const locate = {
            lat: station.latitude,
            long: station.longitude,
            time: Math.round(updated / 1000),
        };
        return this.queryStation.getStatus(station.url, locate).then(status => {
            return this.updateStatus(station, status);
        });
    }

    _requestStationData(station, takeReadings) {
        delete this.queriesInProgress[station.deviceId];

        // if station hasn't been heard from in awhile, disable it
        const elapsed = new Date() - station.lastSeen;
        if (elapsed > Config.stationTimeoutMs && station.lastSeen != pastDate) {
            log.info("station inactive, deactivating");
            return this.deactivateStation(station.deviceId);
        }

        if (!station.connected) {
            return Promise.resolve();
        }

        this.queriesInProgress[station.deviceId] = true;

        return this._statusOrReadings(station, takeReadings)
            .catch(error => {
                return Promise.reject(`statusOrReadings error: ${error}`);
            })
            .finally(value => {
                // NOTE This is intentional, for now. Otherwise the
                // main promise chain is held up by this repeated
                // query and so we never actually return.
                const retryAfterMs = 10000;
                promiseAfter(retryAfterMs).then(() => this._requestStationData(station, false));
                return value;
            });
    }

    updateStatus(station, statusReply) {
        delete this.queriesInProgress[station.deviceId];

        log.verbose("updateStatus");

        if (statusReply.errors.length > 0) {
            return Promise.reject(`status reply has errors: ${statusReply.errors}`);
        }

        if (station.deviceId != statusReply.status.identity.deviceId) {
            return Promise.reject(`status reply device id mismatch: ${station.deviceId} != ${statusReply.status.identity.deviceId}`);
        }

        // now that db can be cleared, might need to re-add stations
        if (!this.stations[station.deviceId]) {
            return this.checkDatabase(station.deviceId, station.url);
        }

        this.stations[station.deviceId].connected = true;
        this.stations[station.deviceId].lastSeen = new Date();

        const pending = [];
        pending.push(this._keepDatabaseFieldsInSync(station, statusReply));
        pending.push(this._updateStationStatusJSON(station, statusReply));
        return Promise.all(pending);
    }

    updateStationReadings(station, result) {
        delete this.queriesInProgress[station.deviceId];

        log.verbose("updateStationReadings");

        if (result.errors.length > 0) {
            return Promise.reject(`status reply has errors: ${result.errors}`);
        }

        if (station.deviceId != result.status.identity.deviceId) {
            return Promise.reject(`status reply device id mismatch: ${station.deviceId} != ${result.status.identity.deviceId}`);
        }

        // now that db can be cleared, might need to re-add stations
        if (!this.stations[station.deviceId]) {
            return this.checkDatabase(station.deviceId, station.url);
        }

        const pending = [];

        this.stations[station.deviceId].connected = true;
        this.stations[station.deviceId].lastSeen = new Date();

        pending.push(this._keepDatabaseFieldsInSync(station, result));

        const readings = {};
        const positions = {};
        result.liveReadings.forEach(lr => {
            lr.modules.forEach(m => {
                if (!m.module.position) {
                    m.module.position = 0;
                }
                positions[m.module.name] = m.module.position;
                m.readings.forEach(r => {
                    readings[m.module.name + r.sensor.name] = r.value || 0;
                });
            });
        });

        const data = {
            stationId: station.id,
            readings: readings,
            positions: positions,
            batteryLevel: result.status.power.battery.percentage,
            consumedMemory: result.status.memory.dataMemoryUsed ? convertBytesToLabel(result.status.memory.dataMemoryUsed) : "Unknown",
            totalMemory: convertBytesToLabel(result.status.memory.dataMemoryInstalled),
            consumedMemoryPercent: result.status.memory.dataMemoryConsumption,
        };

        // store one set of live readings per station
        this.stations[station.deviceId].readings = readings;

        return Promise.all(pending).then(() => {
            return this._updateStationStatusJSON(station, result);
        });
    }

    _keepDatabaseFieldsInSync(station, statusReply) {
        const pending = [];
        const updating = this.stations[station.deviceId];

        log.verbose("keepDatabaseFieldsInSync");

        updating.name = statusReply.status.identity.device;
        updating.status = statusReply.status.recording.enabled ? "recording" : "";
        updating.deployStartTime = statusReply.status.recording.startedTime
            ? new Date(statusReply.status.recording.startedTime * 1000)
            : "";
        updating.batteryLevel = statusReply.status.power.battery.percentage;
        updating.serializedStatus = statusReply.serialized;
        if (statusReply.status.identity.generationId != this.stations[station.deviceId].generationId) {
            updating.generationId = statusReply.status.identity.generationId;
            if (updating.status != "recording") {
                // new generation and not recording, so
                // possible factory reset. reset deploy notes
                pending.push(this.dbInterface.clearDeployNotes(station));
            }
        }

        // With the more complete promise chains, we were getting to
        // updateStation below w/o having this assigned and getting
        // errors.
        this._updateStationStatusJSON(updating, statusReply);

        pending.push(
            this.dbInterface.updateStation(updating).catch(e => {
                return Promise.reject(`error updating station in the db: ${e}`);
            })
        );
        pending.push(this._keepModulesAndSensorsInSync(updating, statusReply));

        // I'd like to move this state manipulation code into objects
        // that have a narrower set of dependencies so that we can do
        // more automated testing. Eventually most of the above code
        // can migrate into these objects.
        try {
            pending.push(this.knownStations.get(station).haveNewStatus(statusReply, this.phone));
        } catch (err) {
            log.error("error", err, err.stack);
        }

        return Promise.all(pending);
    }

    _keepModulesAndSensorsInSync(station, statusReply) {
        const hwModules = statusReply.modules.filter(m => {
            return !is_internal_module(m);
        });

        log.verbose("keepModulesAndSensorsInSync");

        return this.dbInterface.getModules(station.id).then(dbModules => {
            // compare hwModules with dbModules
            const notFromHW = _.differenceBy(dbModules, hwModules, m => m.deviceId);

            // remove modules (and sensors) not in the station's response
            // delete the sensors first to avoid foreign key constraint error
            const dropRemovedSensors = notFromHW.map(m => this.dbInterface.removeSensors(m.deviceId));
            return Promise.all(dropRemovedSensors)
                .then(() => {
                    // remove modules
                    const dropRemovedMOdules = notFromHW.map(m => this.dbInterface.removeModule(m.deviceId));
                    return Promise.all(dropRemovedMOdules);
                })
                .then(() => {
                    // update modules in station's response
                    return hwModules.forEach(hwModule => {
                        const dbModule = dbModules.find(d => {
                            return d.deviceId == hwModule.deviceId;
                        });
                        const pending = [];
                        if (dbModule) {
                            // update name if needed
                            if (dbModule.name != hwModule.name) {
                                pending.push(this.dbInterface.setModuleName(hwModule));
                            }
                            // update bay number if needed
                            if (!hwModule.position) {
                                hwModule.position = 0;
                            }
                            if (dbModule.position != hwModule.position) {
                                pending.push(this.dbInterface.setModulePosition(hwModule));
                            }
                        } else {
                            // add those not in the database
                            hwModule.stationId = station.id;
                            pending.push(this.dbInterface.insertModule(hwModule));
                        }

                        // and update its sensors
                        pending.push(this._updateSensors(hwModule));

                        return Promise.all(pending);
                    });
                });
        });
    }

    _updateSensors(hwModule) {
        const hwSensors = hwModule.sensors.filter(s => {
            return !is_internal_sensor(s);
        });

        return this.dbInterface.getSensors(hwModule.deviceId).then(dbSensors => {
            // compare hwSensors with dbSensors
            // TODO: what if more than one sensor with the same name?
            const notFromHW = _.differenceBy(dbSensors, hwSensors, s => {
                return s.name;
            });
            // remove those that are not on this module anymore
            return Promise.all(
                notFromHW.map(s => {
                    return this.dbInterface.removeSensor(s.id);
                })
            ).then(() => {
                // and add those that are newly present
                const notInDB = _.differenceBy(hwSensors, dbSensors, s => {
                    return s.name;
                });
                return Promise.all(
                    notInDB.map(s => {
                        s.moduleId = hwModule.deviceId;
                        return this.dbInterface.insertSensor(s);
                    })
                );
            });
        });
    }

    recordingStatusChange(address, recording) {
        const stations = Object.values(this.stations);
        const station = stations.find(s => {
            return s.url == address;
        });
        if (station) {
            const newStatus = recording == "started" ? "recording" : "";
            this.stations[station.deviceId].status = newStatus;
            return this._publishStationsUpdated();
        }
    }

    subscribeToStationDiscovery() {
        log.info("subscribing to station discovery");
        return this.discoverStation.subscribeAll(data => {
            switch (data.propertyName.toString()) {
                case this.discoverStation.StationFoundProperty: {
                    return this.checkDatabase(data.value.name, data.value.url);
                }
                case this.discoverStation.StationLostProperty: {
                    return this.deactivateStation(data.value.name);
                }
            }
        });
    }

    checkDatabase(deviceId, address) {
        return this.queryStation
            .getStatus(address)
            .then(statusReply => {
                return this.dbInterface.getStationByDeviceId(deviceId).then(dbStations => {
                    if (dbStations.length == 0) {
                        return this.addToDatabase({
                            deviceId: deviceId,
                            address: address,
                            result: statusReply,
                        });
                    } else {
                        try {
                            return this.reactivateStation(address, dbStations[0], statusReply);
                        } catch (e) {
                            log.error(`error reactivating: ${e.message} ${e.stack}`);
                        }
                    }
                });
            })
            .catch(err => {
                return Promise.reject(`${address}: checkDatabase failed: ${err}`);
            });
    }

    addToDatabase(data) {
        const deviceStatus = data.result.status;
        const modules = data.result.modules;
        const recordingStatus = data.result.status.recording.enabled ? "recording" : "";
        let deployStartTime = data.result.status.recording.startedTime ? new Date(data.result.status.recording.startedTime * 1000) : "";
        // use phone location if station doesn't report coordinates
        let latitude = this.phone.location.latitude;
        if (deviceStatus.gps.latitude && deviceStatus.gps.latitude != 1000) {
            latitude = deviceStatus.gps.latitude.toFixed(6);
        }
        let longitude = this.phone.location.longitude;
        if (deviceStatus.gps.longitude && deviceStatus.gps.longitude != 1000) {
            longitude = deviceStatus.gps.longitude.toFixed(6);
        }

        const station = {
            deviceId: data.deviceId,
            generationId: deviceStatus.identity.generationId,
            name: deviceStatus.identity.device,
            url: data.address,
            status: recordingStatus,
            deployStartTime: deployStartTime,
            connected: true,
            interval: data.result.schedules.readings.interval,
            batteryLevel: deviceStatus.power.battery.percentage,
            longitude: longitude,
            latitude: latitude,
            consumedMemory: deviceStatus.memory.dataMemoryUsed,
            totalMemory: deviceStatus.memory.dataMemoryInstalled,
            consumedMemoryPercent: deviceStatus.memory.dataMemoryConsumption,
        };

        return this.dbInterface.insertStation(station, data.result).then(id => {
            station.id = id;
            return this.activateStation(station);
        });
    }

    sortStations() {
        let stations = Object.values(this.stations);
        // sort by alpha first
        stations = _.sortBy(stations, s => {
            return s.name.toUpperCase();
        });
        // then sort by recency, rounded to hour
        stations = _.orderBy(
            stations,
            s => {
                return s.lastSeen.getHours();
            },
            ["desc"]
        );
        // this will only catch one station, even if more were newly added
        const index = stations.findIndex(s => {
            return s.newlyConnected;
        });
        if (index > -1) {
            const newStation = stations.splice(index, 1)[0];
            newStation.newlyConnected = false;
            stations.unshift(newStation);
        }
        stations.forEach((s, i) => {
            s.sortedIndex = i + "-" + s.deviceId;
        });
        return stations;
    }

    activateStation(station) {
        log.info("activating station --------->", station.name);
        station.lastSeen = new Date();
        station.connected = true;
        station.newlyConnected = true;
        this.stations[station.deviceId] = station;

        const pending = [];

        pending.push(this._requestInitialReadings(station));
        pending.push(this._publishStationsUpdated());

        return Promise.all(pending).then(() => log.info("activate station done", station.name));
    }

    reactivateStation(address, databaseStation, statusResult) {
        log.info("re-activating station --------->", databaseStation.name);
        const deviceId = databaseStation.deviceId;
        if (!this.stations[deviceId]) {
            // TODO: is there an old k:v pair we need to delete?
            this.stations[deviceId] = databaseStation;
        }
        this.stations[deviceId].connected = true;
        this.stations[deviceId].lastSeen = new Date();
        this.stations[deviceId].newlyConnected = true;
        this.stations[deviceId].name = statusResult.status.identity.device;
        this.stations[deviceId].url = address;

        log.info("updating station in database");
        // update the database
        databaseStation.url = address;
        databaseStation.name = statusResult.status.identity.device;

        const pending = [];

        pending.push(this.dbInterface.updateStation(databaseStation));

        pending.push(this._requestInitialReadings(this.stations[deviceId]));
        pending.push(this._publishStationsUpdated());

        return Promise.all(pending).then(() => log.info("re-activated station", databaseStation.name));
    }

    deactivateStation(deviceId) {
        const pending = [];

        if (!deviceId) {
            return Promise.all(pending);
        }

        if (this.stations[deviceId]) {
            log.info("deactivating station --------->", this.stations[deviceId].name);
            this.stations[deviceId].connected = false;
            this.stations[deviceId].lastSeen = pastDate;

            pending.push(this._publishStationsUpdated());
        }

        return Promise.all(pending);
    }

    startLiveReadings(address) {
        if (this.activeAddresses.indexOf(address) == -1) {
            this.activeAddresses.push(address);
        }
    }

    stopLiveReadings(address) {
        const index = this.activeAddresses.indexOf(address);
        if (index > -1) {
            this.activeAddresses.splice(index, 1);
        }
    }

    subscribeAll(receiver) {
        this.subscribe(receiver);
        return this._publishStationsUpdated();
    }

    unsubscribeAll(receiver) {
        log.info("unsubscribeAll");
        this.unsubscribe(receiver);
    }

    _publishStationsUpdated() {
        const stations = this.sortStations();
        const status = _(stations)
            .map(r => [r.name, r.connected])
            .fromPairs()
            .value();
        log.info("publishing updated", status);
        return this.publish(stations);
    }

    _updateStationStatusJSON(station, status) {
        if (status != null) {
            this.stations[station.deviceId].statusJson = status;
            return this._publishStationsUpdated();
        } else {
            log.info("no status for station", station.name);
        }
        return Promise.resolve();
    }
}
