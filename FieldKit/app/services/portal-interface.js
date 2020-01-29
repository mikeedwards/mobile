import _ from "lodash";
import axios from "axios";
import Config from "../config";
import AppSettings from "../wrappers/app-settings";

export default class PortalInterface {
	constructor(services) {
		this.services = services;
		this._handleTokenResponse = this._handleTokenResponse.bind(this);
		this._handleStandardResponse = this._handleStandardResponse.bind(this);
		this._handleError = this._handleError.bind(this);
		this._currentUser = {};
		this._appSettings = new AppSettings();
	}

    storeCurrentUser() {
        return this._query({
            method: "GET",
            url: Config.baseUri + "/user",
        }).then(data => {
			this._currentUser.name = data.name;
			this._currentUser.portalId = data.id;
			return data;
		});
    }

	isAvailable() {
		return axios({
			url: Config.baseUri + "/status",
		}).then(r => {
			return true;
		}, e => {
			return false;
		});
	}

    getCurrentUser() {
        return this._currentUser;
    }

    isLoggedIn() {
        return this._appSettings.getString("accessToken") ? true : false;
    }

    getCurrentToken() {
        return this._appSettings.getString("accessToken");
    }

	login(user) {
		return axios({
			method: "POST",
			url: Config.baseUri + "/login",
			headers: { "Content-Type": "application/json" },
			data: user
		}).then(this._handleTokenResponse).catch(this._handleError);
	}

	logout() {
		this._appSettings.remove("accessToken");
		return Promise.resolve(true);
    }

    register(user) {
        return this._query({
            method: "POST",
            url: Config.baseUri + "/users",
            data: user,
        }).then(() => {
			// TODO This should return the user object.
			return "Account created";
		});
    }

    resetPassword(email) {
	}

    addStation(data) {
        return this._query({
            method: "POST",
            url: Config.baseUri + "/stations",
            data: data
        }).then(data => {
			// TODO This should just return the entire payload just in
			// case other users of this class need more information.
			return data.id;
		});
    }

    updateStation(data, portalId) {
        return this._query({
            method: "PATCH",
            url: Config.baseUri + "/stations/" + portalId,
            data: data
        }).then(data => {
			// TODO This should just return the entire payload just in
			// case other users of this class need more information.
			return data.id;
		});
    }

    getStationSyncState(deviceId) {
        return this._query({
            url: Config.baseUri + "/data/devices/" + deviceId + "/summary",
        });
    }

	getStations() {
        return this._query({
            url: Config.baseUri + "/stations"
		});
	}

    getStationById(id) {
        return this._query({
            url: Config.baseUri + "/stations/@/" + id,
        });
    }

    addFieldNote(data) {
        return this._query({
            method: "POST",
            url: Config.baseUri + "/stations/" + data.stationId + "/field-notes",
            data: data
        });
    }

	listFirmware(module) {
        return this._query({
            url: Config.baseUri + "/firmware" + (module ? "?module=" + module : "")
        });
	}

	onlyIfAuthenticated() {
		if (!this.isLoggedIn()) {
			return Promise.reject(false);
		}
		return this.isAvailable().then(yes => {
			if (!yes) {
				return Promise.reject(false);
			}
			return true;
		});
	}

	downloadFirmware(url, local, progress) {
		const headers = {
			Authorization: this._appSettings.getString("accessToken")
		};
		return this.services.Conservify().download({
			url: Config.baseUri + url,
			path: local,
			headers: { ...headers },
			progress: progress,
		}).then(e => {
			return {
				data: e.body,
				status: e.responseCode
			};
		}, e => {
			return Promise.reject(e);
		});
	}

    addFieldNoteMedia(data) {
		const headers = {
			Authorization: this._appSettings.getString("accessToken")
		};
		return this.services.Conservify().upload({
			url: Config.baseUri + "/stations/" + data.stationId + "/field-note-media",
			method: "POST",
			path: data.pathDest,
			headers: { ...headers },
			progress: (total, copied, info) => {
				// Do nothing.
			}
		}).then(e => {
			return {
				data: e.body,
				status: e.responseCode
			};
		}, e => {
			return Promise.reject(e);
		});
    }

    _handleStandardResponse(response) {
        if (response.status === 200) {
            return response.data;
        }

        if (response.status === 204) {
            return { };
        }

		throw new Error("Query failed");
    }

	_handleTokenResponse(response) {
		if (response.status !== 204) {
			throw new Error("authentication failed");
		}

		// Headers should always be lower case, bug otherwise.
		const accessToken = response.headers.authorization;
		this._appSettings.setString("accessToken", accessToken);
		return this.storeCurrentUser().then(() => {
			return {
				token: accessToken
			};
		});
	}

	_query(req) {
		req.headers = _.merge(req.headers || {}, {
			"Content-Type": "application/json",
			Authorization: this._appSettings.getString("accessToken")
		});

		console.log("portal query", (req.method || 'GET'), req.url);
		return axios(req).then(response => {
			return response.data;
		}, error => {
			if (error.response.status === 401) {
				return this._tryRefreshToken(req);
			}

			console.log("portal error", error.response.status, error.response.data);

			throw error;
		});
	}

	_tryRefreshToken(original) {
		const token = this._parseToken(this._appSettings.getString("accessToken"));
		if (token == null) {
			return Promise.reject("no token");
		}

		const requestBody = {
			refresh_token: token.refresh_token,
		};

		console.log("refreshing token", requestBody);

		return axios({
			method: "POST",
			url: Config.baseUri + "/refresh",
			data: requestBody,
		}).then(response => {
			return this._handleTokenResponse(response).then(() => {
				return this._query(original);
			});
		}, error => {
			console.log("refresh failed", error);
			return this.logout().then(_ => {
				return Promise.reject(error);
			});
		});
	}

	_parseToken(token) {
		try {
			const encoded = token.split('.')[1];
			const decoded = Buffer.from(encoded, "base64").toString();
			return JSON.parse(decoded);
		}
		catch (e) {
			console.log("error parsing token", e, 'token', token);
			return null;
		}
	}

	_handleError(error) {
		throw error;
	}
}
