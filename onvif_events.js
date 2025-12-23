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

    function OnVifEventsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.interval = Number(config.interval) || 5000;
        node.pullTimer = null;
        node.subscriptionId = null;
        node.active = false;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        /* ---------------------------------------------------------
         * Device status listener
         * --------------------------------------------------------- */
        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, "events", status);

                if (status !== "connected") {
                    stopPullLoop();
                }
            };

            node.deviceConfig.addListener("onvif_status", node.listener);
            utils.setNodeStatus(node, "events", node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        /* ---------------------------------------------------------
         * Pull loop control
         * --------------------------------------------------------- */
        function stopPullLoop() {
            if (node.pullTimer) {
                clearTimeout(node.pullTimer);
                node.pullTimer = null;
            }
            node.active = false;
        }

        async function startPullLoop() {
            if (node.active) {
                return;
            }
            node.active = true;
            await pullOnce();
        }

        async function pullOnce() {
            if (!node.active) {
                return;
            }

            try {
                const { data } = await onvifCall({
                    node,
                    cam: node.deviceConfig.cam,
                    method: "pullMessages",
                    args: {
                        Timeout: node.interval,
                        MessageLimit: 10
                    },
                    timeout: node.interval + 2000
                });

                if (data?.NotificationMessage?.length) {
                    const messages = Array.isArray(data.NotificationMessage)
                        ? data.NotificationMessage
                        : [data.NotificationMessage];

                    messages.forEach(event => {
                        node.send({
                            payload: event,
                            topic: event?.Topic?._ || "onvif/event"
                        });
                    });
                }
            }
            catch (err) {
                node.warn(`PullMessages failed: ${err.message}`);
            }
            finally {
                if (node.active) {
                    node.pullTimer = setTimeout(pullOnce, node.interval);
                }
            }
        }

        /* ---------------------------------------------------------
         * Input handler
         * --------------------------------------------------------- */
        node.on("input", async function (msg) {
            const action = node.action || msg.action;
            if (!action) {
                node.error("No action specified");
                return;
            }

            if (!node.deviceConfig || node.deviceConfig.onvifStatus !== "connected") {
                node.error("Device not connected");
                return;
            }

            if (!utils.hasService(node.deviceConfig.cam, "events")) {
                node.error("Events service not supported");
                return;
            }

            try {
                switch (action) {

                    case "subscribe": {
                        stopPullLoop();

                        const { data } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "createPullPointSubscription",
                            timeout: 10000
                        });

                        node.subscriptionId = data?.SubscriptionReference?.Address;
                        await startPullLoop();
                        break;
                    }

                    case "unsubscribe": {
                        stopPullLoop();

                        if (node.subscriptionId) {
                            await onvifCall({
                                node,
                                cam: node.deviceConfig.cam,
                                method: "unsubscribe",
                                timeout: 5000
                            });
                            node.subscriptionId = null;
                        }
                        break;
                    }

                    case "reconnect": {
                        stopPullLoop();
                        await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "connect",
                            retries: 0
                        });
                        break;
                    }

                    default:
                        node.error(`Unsupported action: ${action}`);
                }
            }
            catch (err) {
                node.error(`Action failed: ${err.message}`);
            }
        });

        /* ---------------------------------------------------------
         * Cleanup
         * --------------------------------------------------------- */
        node.on("close", async function () {
            stopPullLoop();

            try {
                if (node.subscriptionId && node.deviceConfig?.cam) {
                    await onvifCall({
                        node,
                        cam: node.deviceConfig.cam,
                        method: "unsubscribe",
                        timeout: 3000
                    });
                }
            }
            catch (_) {
                // ignore shutdown errors
            }

            if (node.listener && node.deviceConfig) {
                node.deviceConfig.removeListener("onvif_status", node.listener);
            }
        });
    }

    RED.nodes.registerType("onvif-events", OnVifEventsNode);
};
