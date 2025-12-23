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

    function OnVifEventsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.eventListener = null;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = (onvifStatus) => {
                // Stop event listener if device disconnects
                if (onvifStatus !== "connected" && node.eventListener) {
                    try {
                        node.deviceConfig.cam.removeListener("event", node.eventListener);
                    } catch (_) {}
                    node.eventListener = null;
                }

                // Override status if actively listening
                const status =
                    onvifStatus === "connected" && node.eventListener
                        ? "listening"
                        : onvifStatus;

                utils.setNodeStatus(node, "event", status);
            };

            node.deviceConfig.addListener("onvif_status", node.listener);
            utils.setNodeStatus(node, "event", node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        node.on("input", function (msg) {
            const action = node.action || msg.action;
            if (!action) {
                node.error("No action specified (node or msg)");
                return;
            }

            if (action !== "reconnect") {
                if (!node.deviceConfig || node.deviceConfig.onvifStatus !== "connected") {
                    node.error("Not connected to device");
                    return;
                }
                if (!utils.hasService(node.deviceConfig.cam, "event")) {
                    node.error("Event service not supported by device");
                    return;
                }
            }

            const newMsg = {
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            try {
                switch (action) {
                    case "start":
                        if (node.eventListener) {
                            node.error("Already listening to events");
                            return;
                        }

                        utils.setNodeStatus(node, "event", "listening");

                        node.eventListener = (camMessage) => {
                            try {
                                const topicRaw = camMessage?.topic?._;
                                if (!topicRaw) return;

                                // Strip namespaces
                                const topic = topicRaw
                                    .split("/")
                                    .map(p => p.split(":").pop())
                                    .join("/");

                                const msgBody = camMessage?.message?.message || {};
                                const meta = msgBody.$ || {};

                                const output = {
                                    topic,
                                    time: meta.UtcTime,
                                    property: meta.PropertyOperation
                                };

                                // SOURCE
                                const src = msgBody.source?.simpleItem;
                                if (src) {
                                    const item = Array.isArray(src) ? src[0] : src;
                                    if (item?.$) {
                                        output.source = {
                                            name: item.$.Name,
                                            value: item.$.Value
                                        };
                                    }
                                }

                                // KEY (pass-through)
                                if (msgBody.key) {
                                    output.key = msgBody.key;
                                }

                                // DATA
                                const data = msgBody.data;
                                if (data?.simpleItem) {
                                    const items = Array.isArray(data.simpleItem)
                                        ? data.simpleItem
                                        : [data.simpleItem];

                                    output.data = items.map(i => ({
                                        name: i.$?.Name,
                                        value: i.$?.Value
                                    }));
                                }
                                else if (data?.elementItem) {
                                    output.data = {
                                        type: "elementItem",
                                        value: data.elementItem
                                    };
                                }

                                node.send(output);
                            }
                            catch (err) {
                                node.warn(`Event parse error: ${err.message}`);
                            }
                        };

                        node.deviceConfig.cam.on("event", node.eventListener);
                        break;

                    case "stop":
                        if (!node.eventListener) {
                            node.error("Not currently listening");
                            return;
                        }

                        node.deviceConfig.cam.removeListener("event", node.eventListener);
                        node.eventListener = null;
                        utils.setNodeStatus(node, "event", "connected");
                        break;

                    case "getEventProperties":
                        node.deviceConfig.cam.getEventProperties((err, data, xml) => {
                            if (err) {
                                utils.handleResult(node, err, null, xml, newMsg);
                                return;
                            }

                            const simplified = {};

                            function simplify(src, dst) {
                                if (!src || typeof src !== "object") return;
                                for (const k in src) {
                                    if (k === "$") continue;
                                    if (k === "messageDescription") {
                                        dst.messageDescription = src[k];
                                        return;
                                    }
                                    dst[k] = {};
                                    simplify(src[k], dst[k]);
                                }
                            }

                            simplify(data?.topicSet, simplified);
                            utils.handleResult(node, null, simplified, xml, newMsg);
                        });
                        break;

                    case "getEventServiceCapabilities":
                        node.deviceConfig.cam.getEventServiceCapabilities(
                            (err, data, xml) =>
                                utils.handleResult(node, err, data, xml, newMsg)
                        );
                        break;

                    case "reconnect":
                        try {
                            node.deviceConfig.cam.connect();
                        } catch (err) {
                            node.error(`Reconnect failed: ${err.message}`);
                        }
                        break;

                    default:
                        node.error(`Unsupported action: ${action}`);
                }
            }
            catch (err) {
                node.error(`Action ${action} failed: ${err.message}`);
            }
        });

        node.on("close", () => {
            if (node.listener && node.deviceConfig) {
                node.deviceConfig.removeListener("onvif_status", node.listener);
            }
            if (node.eventListener && node.deviceConfig) {
                try {
                    node.deviceConfig.cam.removeListener("event", node.eventListener);
                } catch (_) {}
                node.eventListener = null;
            }
        });
    }

    RED.nodes.registerType("onvif-events", OnVifEventsNode);
};
