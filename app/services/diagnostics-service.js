import _ from "lodash";
import * as utils from "tns-core-modules/utils/utils";
import * as platform from "tns-core-modules/platform";
import { Folder, path, File, knownFolders } from "tns-core-modules/file-system";
import { copyLogs } from "../lib/logging";
import { serializePromiseChain, getPathTimestamp } from "../utilities";
import { listAllFiles, dumpAllFiles } from "../lib/fs";
import Config, { Build } from "../config";

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export default class Diagnostics {
    constructor(services) {
        this.services = services;
        this.baseUrl = "https://code.conservify.org/diagnostics";
    }

    upload(progress) {
        const id = uuidv4();

        console.log("upload diagnostics", id);

        progress({ id: id, message: "Starting..." });

        return Promise.resolve(true)
            .then(() => {
                return dumpAllFiles();
            })
            .then(() => {
                progress({ id: id, message: "Uploading device information." });
                return this._uploadDeviceInformation(id);
            })
            .then(() => {
                progress({ id: id, message: "Querying stations." });
                return this._queryLogs();
            })
            .then(allLogs => {
                progress({ id: id, message: "Uploading station logs." });
                return this._uploadAllLogs(id, allLogs);
            })
            .then(() => {
                progress({ id: id, message: "Uploading app logs." });
                return this._uploadAppLogs(id);
            })
            .then(() => {
                progress({ id: id, message: "Uploading database." });
                return this._uploadDatabase(id);
            })
            .then(reference => {
                return this._uploadArchived().then(() => {
                    progress({ id: id, message: "Done!" });
                    console.log("diagnostics", JSON.parse(reference));
                    return {
                        reference: JSON.parse(reference),
                        id: id,
                    };
                });
            });
    }

    _backupDatabase(folder) {
        return Promise.resolve();
    }

    _uploadDeviceInformation(id) {
        const device = platform.device;

        const info = {
            deviceType: device.deviceType,
            language: device.language,
            manufacturer: device.manufacturer,
            model: device.model,
            os: device.os,
            osVersion: device.osVersion,
            region: device.region,
            sdkVersion: device.sdkVersion,
            uuid: device.uuid,
            config: Config,
            build: Build,
        };

        console.log("device info", info);

        return this.services.Conservify().text({
            method: "POST",
            url: this.baseUrl + "/" + id + "/device.json",
            body: JSON.stringify(info),
        });
    }

    _uploadArchived() {
        const folder = this._getDiagnosticsFolder();

        return this._getAllFiles(folder).then(files => {
            console.log("uploading", files);
            return serializePromiseChain(files, (path, index) => {
                const relative = path.replace(folder.path, "");
                return this.services
                    .Conservify()
                    .upload({
                        method: "POST",
                        url: this.baseUrl + relative,
                        path: path,
                    })
                    .then(() => {
                        return File.fromPath(path).remove();
                    });
            });
        });
    }

    save() {
        return Promise.resolve().then(() => {
            const folder = this._getNewFolder();

            return Promise.all([
                copyLogs(folder.getFile("app.txt")),
                this._backupDatabase(folder),
                this._queryLogs().then(allLogs => {
                    return Promise.all(
                        allLogs.map(row => {
                            return Promise.all([
                                folder.getFile(row.name + ".json").writeText(JSON.stringify(row.status)),
                                folder.getFile(row.name + ".txt").writeText(row.logs),
                            ]);
                        })
                    );
                }),
            ]);
        });
    }

    _queryLogs() {
        return this.services
            .DiscoverStation()
            .getConnectedStations()
            .then(stations => {
                console.log("connected", stations);

                if (true) {
                    return [];
                }

                return Promise.all(
                    Object.values(stations).map(station => {
                        return this._queryStationLogs(station);
                    })
                ).then(all => {
                    return _.compact(all);
                });
            });
    }

    _queryStationLogs(station) {
        return this.services
            .QueryStation()
            .getStatus(station.url)
            .catch(_ => {
                return null;
            })
            .then(status => {
                return this.services
                    .QueryStation()
                    .queryLogs(station.url)
                    .then(logs => {
                        const name = status.status.identity.deviceId;
                        return {
                            name: name,
                            status: status,
                            station: station,
                            logs: logs,
                        };
                    });
            });
    }

    _uploadAllLogs(id, allLogs) {
        return Promise.all(
            allLogs.map(row => {
                return this._uploadLogs(id, row);
            })
        );
    }

    _uploadAppLogs(id) {
        const copy = this._getDiagnosticsFolder().getFile("uploading.txt");
        return copyLogs(copy).then(() => {
            return this.services
                .Conservify()
                .upload({
                    method: "POST",
                    url: this.baseUrl + "/" + id + "/app.txt",
                    path: copy.path,
                })
                .then(() => {
                    return File.fromPath(copy.path).remove();
                });
        });
    }

    _uploadLogs(id, logs) {
        return this.services
            .Conservify()
            .text({
                method: "POST",
                url: this.baseUrl + "/" + id + "/" + logs.name + ".json",
                body: JSON.stringify(logs.status),
            })
            .then(() => {
                return this.services.Conservify().text({
                    method: "POST",
                    url: this.baseUrl + "/" + id + "/" + logs.name + ".txt",
                    body: logs.logs,
                });
            });
    }

    _uploadDatabase(id) {
        console.log("getting database path");

        const path = this._getDatabasePath("fieldkit.sqlite3");

        console.log("diagnostics", path);

        return this.services
            .Conservify()
            .upload({
                method: "POST",
                url: this.baseUrl + "/" + id + "/fk.db",
                path: path,
            })
            .then(response => {
                return response.body;
            });
    }

    _getDatabasePath(name) {
        try {
            if (platform.isAndroid) {
                const context = utils.ad.getApplicationContext();
                return context.getDatabasePath(name).getAbsolutePath();
            }

            const folder = knownFolders.documents().path;
            return folder + "/" + name;
        } catch (e) {
            console.log("error getting path", e);
            return null;
        }
    }

    _getAllFiles(f) {
        return listAllFiles(f).then(files => {
            return _(files)
                .filter(f => f.depth > 0)
                .map(f => f.path)
                .value();
        });
    }

    _getDiagnosticsFolder() {
        return knownFolders.documents().getFolder("diagnostics");
    }

    _getNewFolder() {
        const id = uuidv4();
        return this._getDiagnosticsFolder().getFolder(id);
    }
}
