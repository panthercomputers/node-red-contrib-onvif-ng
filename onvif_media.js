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
    const utils = require("./utils");
    const { onvifCall } = require("./utils/onvifCall");

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
         * Secure snapshot fetch (Node 18+ fetch)
         */
        async function fetchSnapshot(uri, msg) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            try {
                const { user, password } = node.deviceConfig.credentials || {};
                if (!user || !password) {
                    throw new Error("Missing camera credentials");
                }

                const auth = Buffer
                    .from(`${user}:${password}`)
                    .toString("base64");

                const res = await fetch(uri, {
                    headers: { Authorization: `Basic ${auth}` },
                    signal: controller.signal
                });

                if (!res.ok) {
                    throw new Error(`Snapshot HTTP ${res.status}`);
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

        node.on("input", async function (msg) {
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

            const outMsg = {
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            try {
                switch (action) {

                    case "getSnapshot": {
                        const cachedUri = node.snapshotUriMap.get(profileToken);
                        if (cachedUri) {
                            await fetchSnapshot(cachedUri, outMsg);
                            return;
                        }

                        const { data } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "getSnapshotUri",
                            args: { profileToken }
                        });

                        if (!data?.uri) {
                            throw new Error("No snapshot URI returned");
                        }

                        node.snapshotUriMap.set(profileToken, data.uri);
                        await fetchSnapshot(data.uri, outMsg);
                        break;
                    }

                    case "getStreamUri": {
                        const { data, xml } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "getStreamUri",
                            args: {
                                stream: node.stream || msg.stream,
                                protocol: node.protocol || msg.protocol,
                                profileToken
                            }
                        });

                        utils.handleResult(node, null, data, xml, outMsg);
                        break;
                    }

                    case "reconnect":
                        await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "connect",
                            timeout: 5000,
                            retries: 0
                        });
                        break;

                    default:
                        node.error(`Unsupported action: ${action}`);
                }
            }
            catch (err) {
                utils.handleResult(node, err, null, null, outMsg);
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
