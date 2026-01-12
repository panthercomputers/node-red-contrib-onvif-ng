/**
 * Original work:
 * Copyright 2018 Bart Butenaers
 *
 * Modernization & fixes:
 * Copyright 2025–2026 Panther Computers
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
                node.status({ fill: "grey", shape: "ring", text: "not configured" });
                break;
            default:
                node.status({});
        }
    }

    function normalizeProfiles(cam) {
        if (!cam || !Array.isArray(cam.profiles)) return [];

        return cam.profiles.map(p => ({
            name: p.name,
            token: p.$?.token || p.token || null,
            raw: p
        })).filter(p => p.token);
    }

    function OnVifConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        /* ------------------------------------------------------------
         * Configuration
         * ---------------------------------------------------------- */
        node.xaddress = config.xaddress;
        node.port = Number(config.port || 80);
        node.name = config.name;
        node.timeout = Number(config.timeout || 3);
        node.checkConnectionInterval = Number(config.checkConnectionInterval || 5);

        node.cam = null;
        node.profileCache = null;

        node._initializing = false;
        node._checking = false;
        node.checkConnectionTimer = null;

        node.setMaxListeners(50);

        /* ------------------------------------------------------------
         * Profile helpers (RUNTIME CONTRACT)
         * ---------------------------------------------------------- */

        node.getProfiles = function () {
            return node.profileCache || [];
        };

        node.getProfileTokenByName = function (profileName) {
            if (!profileName || !node.profileCache) return null;
            for (const p of node.profileCache) {
                if (p.name === profileName) {
                    return p.token;
                }
            }
            return null;
        };

        /* ------------------------------------------------------------
         * Initialization / connection (RUNTIME ONLY)
         * ---------------------------------------------------------- */
        node.initialize = function () {
            if (node.cam || node._initializing) return;

            if (!node.xaddress) {
                setOnvifStatus(node, STATUS.UNCONFIGURED);
                node.error("ONVIF device address not configured");
                return;
            }

            const creds = node.credentials || {};
            const username = creds.user;
            const password = creds.password;

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

            node.cam = new onvif.Cam(options, err => {
                node._initializing = false;

                if (err) {
                    node.cam = null;
                    node.profileCache = null;
                    node.error(err);
                    setOnvifStatus(node, STATUS.DISCONNECTED);
                    return;
                }

                try {
                    node.profileCache = normalizeProfiles(node.cam);
                } catch (e) {
                    node.profileCache = [];
                    node.error(e);
                }

                setOnvifStatus(node, STATUS.CONNECTED);
            });

            /* ------------------------------------------------------------
             * Connection watchdog
             * ---------------------------------------------------------- */
            if (node.checkConnectionTimer) {
                clearInterval(node.checkConnectionTimer);
            }

            if (node.checkConnectionInterval > 0) {
                node.checkConnectionTimer = setInterval(() => {
                    if (!node.cam || node._checking) return;

                    node._checking = true;

                    node.cam.getSystemDateAndTime(err => {
                        node._checking = false;

                        if (err) {
                            setOnvifStatus(node, STATUS.DISCONNECTED);
                            return;
                        }

                        if (!node.cam.capabilities && node.cam.connect) {
                            node.cam.connect(() => {});
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
            }
            node.cam = null;
            node.profileCache = null;
            node.removeAllListeners("onvif_status");
        });
    }

    /* ------------------------------------------------------------
     * Admin endpoint: PROFILES (EDITOR CONTRACT)
     * ---------------------------------------------------------- */
    RED.httpAdmin.get("/onvifdevice/profiles/:id", function (req, res) {
        const configNode = RED.nodes.getNode(req.params.id);

        /* --------------------------------------------------------
         * 1️⃣ If runtime cache exists → return it
         * ------------------------------------------------------ */
        if (configNode && configNode.profileCache) {
            return res.json(
                configNode.profileCache.map(p => ({
                    label: p.name,
                    value: p.token
                }))
            );
        }

        /* --------------------------------------------------------
         * 2️⃣ Dirty editor config → temp Cam (NO SIDE EFFECTS)
         * ------------------------------------------------------ */
        try {
            const hostname = req.query.hostname || req.query.xaddress;
            const port = Number(req.query.port || 80);
            const username = req.query.user;
            const password = req.query.password;

            if (!hostname || !username || !password) {
                return res.json([]);
            }

            const cam = new onvif.Cam({
                hostname,
                port,
                username,
                password,
                timeout: 5000
            }, err => {
                if (err || !cam.profiles) {
                    return res.json([]);
                }

                const profiles = normalizeProfiles(cam);
                res.json(
                    profiles.map(p => ({
                        label: p.name,
                        value: p.token
                    }))
                );
            });
        } catch (e) {
            res.json([]);
        }
    });

    RED.nodes.registerType("onvif-config", OnVifConfigNode, {
        credentials: {
            user: { type: "text" },
            password: { type: "password" }
        }
    });
};
