/**
 * Original work:
 * Copyright 2018 Bart Butenaers
 *
 * Modifications:
 * Copyright 2025 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0
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

        switch (status) {
            case STATUS.CONNECTED:
                node.status({ fill: "green", shape: "dot", text: "connected" });
                break;
            case STATUS.INITIALIZING:
                node.status({ fill: "yellow", shape: "ring", text: "connecting" });
                break;
            case STATUS.DISCONNECTED:
                node.status({ fill: "red", shape: "ring", text: "disconnected" });
                break;
            case STATUS.UNCONFIGURED:
                node.status({ fill: "grey", shape: "ring", text: "credentials missing" });
                break;
            default:
                node.status({});
        }
    }

    function OnVifConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.xaddress = config.xaddress;
        this.port = Number(config.port || 80);
        this.name = config.name;
        this.timeout = Number(config.timeout || 3);
        this.checkConnectionInterval = Number(config.checkConnectionInterval || 5);

        node.cam = null;
        node._initializing = false;
        node._checking = false;
        node.checkConnectionTimer = null;

        node.setMaxListeners(50);

        /* ------------------------------------------------------------
         * Initialization / connection
         * ---------------------------------------------------------- */
        this.initialize = function () {
            if (node.cam || node._initializing) return;

            if (!node.xaddress) {
                setOnvifStatus(node, STATUS.UNCONFIGURED);
                node.error("ONVIF device address not configured");
                return;
            }

            const creds = node.credentials || {};

            // 🔐 Credential validation (PORTABLE AUTH)
            let username = creds.user;
            let password = creds.password;

            // Optional environment variable fallback
            if (!username && process.env.ONVIF_USER) {
                username = process.env.ONVIF_USER;
                password = process.env.ONVIF_PASS;
            }

            if (!username || !password) {
                setOnvifStatus(node, STATUS.UNCONFIGURED);
                node.error("ONVIF credentials are not configured");
                return;
            }

            node._initializing = true;
            setOnvifStatus(node, STATUS.INITIALIZING);

            const options = {
                hostname: node.xaddress,
                port: node.port,
                username,
                password,
                timeout: node.timeout * 1000
            };

            node.cam = new onvif.Cam(options, (err) => {
                node._initializing = false;

                if (err) {
                    node.error(err);
                    setOnvifStatus(node, STATUS.DISCONNECTED);
                } else {
                    setOnvifStatus(node, STATUS.CONNECTED);
                }
            });

            if (node.checkConnectionTimer) {
                clearInterval(node.checkConnectionTimer);
                node.checkConnectionTimer = null;
            }

            if (node.checkConnectionInterval > 0) {
                node.checkConnectionTimer = setInterval(() => {
                    if (!node.cam || node._checking) return;

                    node._checking = true;

                    node.cam.getSystemDateAndTime((err) => {
                        node._checking = false;

                        if (err) {
                            setOnvifStatus(node, STATUS.DISCONNECTED);
                            return;
                        }

                        setOnvifStatus(node, STATUS.CONNECTED);
                    });
                }, node.checkConnectionInterval * 1000);
            }
        };

        /* ------------------------------------------------------------
         * Cleanup
         * ---------------------------------------------------------- */
        node.on("close", function () {
            setOnvifStatus(node, "");

            if (node.checkConnectionTimer) {
                clearInterval(node.checkConnectionTimer);
                node.checkConnectionTimer = null;
            }

            node.cam = null;
            node._checking = false;
            node._initializing = false;
            node.removeAllListeners("onvif_status");
        });
    }

    RED.nodes.registerType("onvif-config", OnVifConfigNode, {
        credentials: {
            user: { type: "text" },
            password: { type: "password" }
        }
    });
};
