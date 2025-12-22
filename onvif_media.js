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
    const utils = require("./utils");

    function OnVifMediaNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.profileToken = config.profileToken;
        node.profileName = config.profileName;
        node.protocol = config.protocol;
        node.stream = config.stream;
        node.snapshotUriMap = new Map();

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, "media", status);
            };
            node.deviceConfig.addListener("onvif_status", node.listener);
            utils.setNodeStatus(node, "media", node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        /**
         * SAFE snapshot fetch with timeout + abort
         */
        async function fetchSnapshot(uri, msg) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            try {
                const { user, password } = node.deviceConfig.credentials || {};
                if (!user || !password) {
                    node.error("Missing camera credentials");
                    return;
                }

                const auth = Buffer
                    .from(`${user}:${password}`)
                    .toString("base64");

                const res = await fetch(uri, {
                    headers: { Authorization: `Basic ${auth}` },
                    signal: controller.signal
                });

                if (!res.ok) {
                    node.error(`Snapshot HTTP ${res.status}`);
                    return;
                }

                const buffer = Buffer.from(await res.arrayBuffer());
                msg.payload = buffer;
                msg.contentType =
                    res.headers.get("content-type") || "image/jpeg";

                node.send(msg);
            }
            catch (err) {
                if (err.name !== "AbortError") {
                    node.error(`Snapshot error: ${err.message}`);
                }
            }
            finally {
                clearTimeout(timeout);
            }
        }

        node.on("input", function (msg) {
            const action = node.action || msg.action;
            if (!action) {
                node.error("No action specified");
                return;
            }

            if (action !== "reconnect") {
                if (!node.deviceConfig || node.deviceConfig.onvifStatus !== "connected") {
                    node.error("Not connected to device");
                    return;
                }
                if (!utils.hasService(node.deviceConfig.cam, "media")) {
                    node.error("Media service not supported");
                    return;
                }
            }

            const profileToken =
                node.profileToken ||
                msg.profileToken ||
                (node.profileName
                    ? node.deviceConfig.getProfileTokenByName(node.profileName)
                    : undefined);

            const newMsg = {
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            try {
                switch (action) {
                    case "getSnapshot": {
                        const cached = node.snapshotUriMap.get(profileToken);
                        if (cached) {
                            fetchSnapshot(cached, newMsg);
                            return;
                        }

                        node.deviceConfig.cam.getSnapshotUri(
                            { profileToken },
                            (err, stream) => {
                                if (err || !stream?.uri) {
                                    node.error(`Snapshot URI failed: ${err?.message || "unknown"}`);
                                    return;
                                }
                                node.snapshotUriMap.set(profileToken, stream.uri);
                                fetchSnapshot(stream.uri, newMsg);
                            }
                        );
                        break;
                    }

                    case "getStreamUri":
                        node.deviceConfig.cam.getStreamUri(
                            {
                                stream: node.stream || msg.stream,
                                protocol: node.protocol || msg.protocol,
                                profileToken
                            },
                            (err, stream, xml) =>
                                utils.handleResult(node, err, stream, xml, newMsg)
                        );
                        break;

                    case "reconnect":
                        node.deviceConfig.cam.connect();
                        break;

                    default:
                        node.error(`Unsupported action: ${action}`);
                }
            }
            catch (err) {
                node.error(`Action failed: ${err.message}`);
            }
        });

        node.on("close", () => {
            if (node.listener) {
                node.deviceConfig.removeListener("onvif_status", node.listener);
            }
        });
    }

    RED.nodes.registerType("onvif-media", OnVifMediaNode);
};
