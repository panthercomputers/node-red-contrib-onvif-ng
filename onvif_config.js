/**
 * Original work:
 * Copyright 2018 Bart Butenaers
 *
 * Modifications:
 * Copyright 2025 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function (RED) {
    const onvif = require("onvif");

    const STATUS = {
        CONNECTED: "connected",
        DISCONNECTED: "disconnected",
        INITIALIZING: "initializing",
        UNCONFIGURED: "unconfigured"
    };

    function setOnvifStatus(node, status) {
        node.onvifStatus = status;
        node.emit("onvif_status", status);
    }

    function OnVifConfigNode(config) {
        RED.nodes.createNode(this, config);

        this.xaddress = config.xaddress;
        this.port = parseInt(config.port || 80, 10);
        this.name = config.name;
        this.timeout = Number(config.timeout || 3);
        this.checkConnectionInterval = Number(config.checkConnectionInterval || 5);

        const node = this;

        // Prevent listener warnings without disabling leak detection entirely
        node.setMaxListeners(50);

        node.cam = null;
        node._initializing = false;
        node._checking = false;
        node.checkConnectionTimer = null;

        /* ------------------------------------------------------------
         * Profiles helper (used by editor UI)
         * ---------------------------------------------------------- */
        this.getProfiles = function (clientConfig, response) {
            const profileNames = [];

            const creds = this.credentials || {};

            clientConfig.username = clientConfig.user || creds.user;
            clientConfig.password = clientConfig.password || creds.password;
            clientConfig.hostname = clientConfig.hostname || this.xaddress;
            clientConfig.port = clientConfig.port || this.port;
            clientConfig.timeout = (this.timeout || 3) * 1000;

            // Restore masked password if needed
            if (clientConfig.password && creds.password) {
                clientConfig.password =
                    clientConfig.password.replace("___PWRD__", creds.password);
            }

            const sameAuth =
                creds.user === clientConfig.username &&
                creds.password === clientConfig.password &&
                this.xaddress === clientConfig.hostname &&
                this.port === clientConfig.port;

            const finish = (cam) => {
                if (cam && cam.profiles) {
                    for (let i = 0; i < cam.profiles.length; i++) {
                        profileNames.push({
                            label: cam.profiles[i].name,
                            value: cam.profiles[i].$.token
                        });
                    }
                }
                response.json(profileNames);
            };

            if (!sameAuth) {
                new onvif.Cam(clientConfig, function (err) {
                    if (err) {
                        response.status(500).json([]);
                        return;
                    }
                    finish(this);
                });
            } else {
                finish(this.cam);
            }
        };

        this.getProfileTokenByName = function (profileName) {
            if (!this.cam || !this.cam.profiles) return null;

            for (let i = 0; i < this.cam.profiles.length; i++) {
                if (this.cam.profiles[i].name === profileName) {
                    return this.cam.profiles[i].$.token;
                }
            }
            return null;
        };

        /* ------------------------------------------------------------
         * Initialization / connection
         * ---------------------------------------------------------- */
        this.initialize = function () {
            if (this.cam || this._initializing) return;

            if (!this.xaddress) {
                node.error("Cannot connect to unconfigured ONVIF device", {});
                setOnvifStatus(node, STATUS.UNCONFIGURED);
                return;
            }

            this._initializing = true;
            setOnvifStatus(node, STATUS.INITIALIZING);

            const options = {
                hostname: this.xaddress,
                port: this.port,
                timeout: this.timeout * 1000
            };

            if (this.credentials && this.credentials.user) {
                options.username = this.credentials.user;
                options.password = this.credentials.password;
            }

            this.cam = new onvif.Cam(options, (err) => {
                this._initializing = false;

                if (err) {
                    node.error(err, {});
                    setOnvifStatus(node, STATUS.DISCONNECTED);
                } else {
                    setOnvifStatus(node, STATUS.CONNECTED);
                }
            });

            if (this.checkConnectionTimer) {
                clearInterval(this.checkConnectionTimer);
                this.checkConnectionTimer = null;
            }

            if (this.checkConnectionInterval > 0) {
                this.checkConnectionTimer = setInterval(() => {
                    if (!node.cam || node._checking) return;

                    node._checking = true;

                    node.cam.getSystemDateAndTime((err) => {
                        node._checking = false;

                        if (err) {
                            setOnvifStatus(node, STATUS.DISCONNECTED);
                            return;
                        }

                        if (!node.cam.capabilities && !node.cam.services) {
                            node.cam.connect((connectErr) => {
                                if (connectErr) {
                                    node.error(
                                        "Device connected but capabilities could not be loaded"
                                    );
                                }
                            });
                        }

                        setOnvifStatus(node, STATUS.CONNECTED);
                    });
                }, this.checkConnectionInterval * 1000);
            }
        };

        /* ------------------------------------------------------------
         * Cleanup
         * ---------------------------------------------------------- */
        node.on("close", function () {
            setOnvifStatus(this, "");

            this.removeAllListeners("onvif_status");

            if (this.checkConnectionTimer) {
                clearInterval(this.checkConnectionTimer);
                this.checkConnectionTimer = null;
            }

            this.cam = null;
            this._checking = false;
            this._initializing = false;
        });
    }

    RED.nodes.registerType("onvif-config", OnVifConfigNode, {
        credentials: {
            user: { type: "text" },
            password: { type: "password" }
        }
    });

    /* ------------------------------------------------------------
     * Admin HTTP endpoint (editor UI)
     * ---------------------------------------------------------- */
    RED.httpAdmin.get(
        "/onvifdevice/:cmd/:config_node_id",
        RED.auth.needsPermission("onvifdevice.read"),
        function (req, res) {
            const configNode = RED.nodes.getNode(req.params.config_node_id);
            if (!configNode) {
                res.status(404).json([]);
                return;
            }

            switch (req.params.cmd) {
                case "profiles":
                    configNode.getProfiles(req.query, res);
                    break;
                default:
                    res.status(400).json([]);
            }
        }
    );
};
