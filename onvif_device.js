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
    const utils = require("./utils");

    function OnVifDeviceNode(config) {
        RED.nodes.createNode(this, config);

        this.action = config.action;
        const node = this;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = function (onvifStatus) {
                utils.setNodeStatus(node, "device", onvifStatus);
            };

            node.deviceConfig.addListener("onvif_status", node.listener);
            utils.setNodeStatus(node, "device", node.deviceConfig.onvifStatus);

            node.deviceConfig.initialize();
        }

        node.on("input", function (msg) {
            const newMsg = {};
            const action = node.action || msg.action;

            if (!action) {
                node.warn(
                    "No action specified (configure node or set msg.action)"
                );
                return;
            }

            // Connection checks (except reconnect)
            if (action !== "reconnect") {
                if (
                    !node.deviceConfig ||
                    node.deviceConfig.onvifStatus !== "connected"
                ) {
                    node.error("This node is not connected to a device");
                    return;
                }

                if (!utils.hasService(node.deviceConfig.cam, "device")) {
                    node.error(
                        "The device does not support the ONVIF Device service"
                    );
                    return;
                }
            }

            newMsg.xaddr = node.deviceConfig.xaddress;
            newMsg.action = action;

            try {
                const cam = node.deviceConfig.cam;

                switch (action) {
                    case "getDeviceInformation":
                        cam.getDeviceInformation((err, data, xml) => {
                            utils.handleResult(node, err, data, xml, newMsg);
                        });
                        break;

                    case "getHostname":
                        cam.getHostname((err, data, xml) => {
                            utils.handleResult(node, err, data, xml, newMsg);
                        });
                        break;

                    case "getSystemDateAndTime":
                        cam.getSystemDateAndTime((err, data, xml) => {
                            utils.handleResult(node, err, data, xml, newMsg);
                        });
                        break;

                    case "getServices":
                    case "getCapabilities":
                    case "getServiceCapabilities":
                        cam.getCapabilities((err, data, xml) => {
                            utils.handleResult(node, err, data, xml, newMsg);
                        });
                        break;

                    case "getScopes":
                        cam.getScopes((err, data, xml) => {
                            utils.handleResult(node, err, data, xml, newMsg);
                        });
                        break;

                    case "systemReboot":
                        cam.systemReboot((err, data, xml) => {
                            utils.handleResult(node, err, data, xml, newMsg);
                        });
                        break;

                    case "reconnect":
                        cam.connect((err) => {
                            if (err) {
                                node.error("Reconnect failed: " + err.message);
                            }
                            utils.handleResult(node, err, "", null, newMsg);
                        });
                        break;

                    default:
                        node.error("Action '" + action + "' is not supported");
                }
            } catch (err) {
                node.error("Action '" + action + "' failed: " + err.message);
            }
        });

        node.on("close", function () {
            if (node.listener && node.deviceConfig) {
                node.deviceConfig.removeListener(
                    "onvif_status",
                    node.listener
                );
            }
        });
    }

    // ✅ FIXED constructor name reference
    RED.nodes.registerType("onvif2026-device", OnVifDeviceNode);
};
