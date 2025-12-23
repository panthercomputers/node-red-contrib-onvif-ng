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

    function OnVifDeviceNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;

        // Retrieve config node
        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, "device", status);
            };

            node.deviceConfig.addListener("onvif_status", node.listener);
            utils.setNodeStatus(node, "device", node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        node.on("input", async function (msg) {
            const action = node.action || msg.action;
            if (!action) {
                node.error("No action specified (node.action or msg.action)");
                return;
            }

            if (action !== "reconnect") {
                if (!node.deviceConfig || node.deviceConfig.onvifStatus !== "connected") {
                    node.error("This node is not connected to a device");
                    return;
                }

                if (!utils.hasService(node.deviceConfig.cam, "device")) {
                    node.error("The device does not support the Device service");
                    return;
                }
            }

            const outMsg = {
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            try {
                switch (action) {

                    case "getDeviceInformation": {
                        const { data, xml } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "getDeviceInformation"
                        });
                        utils.handleResult(node, null, data, xml, outMsg);
                        break;
                    }

                    case "getHostname": {
                        const { data, xml } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "getHostname"
                        });
                        utils.handleResult(node, null, data, xml, outMsg);
                        break;
                    }

                    case "getSystemDateAndTime": {
                        const { data, xml } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "getSystemDateAndTime"
                        });
                        utils.handleResult(node, null, data, xml, outMsg);
                        break;
                    }

                    case "getServices":
                    case "getCapabilities":
                    case "getServiceCapabilities": {
                        const { data, xml } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "getCapabilities"
                        });
                        utils.handleResult(node, null, data, xml, outMsg);
                        break;
                    }

                    case "getScopes": {
                        const { data, xml } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "getScopes"
                        });
                        utils.handleResult(node, null, data, xml, outMsg);
                        break;
                    }

                    case "systemReboot": {
                        const { data, xml } = await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "systemReboot",
                            timeout: 15000
                        });
                        utils.handleResult(node, null, data, xml, outMsg);
                        break;
                    }

                    case "reconnect": {
                        await onvifCall({
                            node,
                            cam: node.deviceConfig.cam,
                            method: "connect",
                            retries: 0,
                            timeout: 5000
                        });
                        break;
                    }

                    default:
                        node.error(`Unsupported action: ${action}`);
                }
            }
            catch (err) {
                utils.handleResult(node, err, null, null, outMsg);
            }
        });

        node.on("close", function () {
            if (node.listener && node.deviceConfig) {
                node.deviceConfig.removeListener("onvif_status", node.listener);
            }
        });
    }

    RED.nodes.registerType("onvif-device", OnVifDeviceNode);
};
