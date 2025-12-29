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
    const onvif = require('onvif');
    const utils = require('./utils');

    function OnVifPTZNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.profileToken = config.profileToken;
        node.speed = config.speed;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, 'ptz', status);
            };

            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'ptz', node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        node.on('input', function (msg) {
            const action = node.action || msg.action;

            if (!action) {
                node.error('No action specified');
                return;
            }

            if (action !== 'reconnect') {
                if (!node.deviceConfig || node.deviceConfig.onvifStatus !== 'connected') {
                    node.error('Not connected to device');
                    return;
                }

                if (!utils.hasService(node.deviceConfig.cam, 'ptz')) {
                    node.error('PTZ service not supported by device');
                    return;
                }
            }

            const profileToken =
                node.profileToken ||
                msg.profileToken ||
                node.deviceConfig?.defaultProfileToken;

            if (!profileToken && action !== 'reconnect') {
                node.error('No profileToken available');
                return;
            }

            const speed = msg.speed || node.speed || {};

            const newMsg = {
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            try {
                switch (action) {
                    case 'continuousMove':
                        node.deviceConfig.cam.continuousMove(
                            {
                                profileToken,
                                velocity: speed
                            },
                            (err, result, xml) =>
                                utils.handleResult(node, err, result, xml, newMsg)
                        );
                        break;

                    case 'relativeMove':
                        if (!msg.translation) {
                            node.error('msg.translation is required');
                            return;
                        }

                        node.deviceConfig.cam.relativeMove(
                            {
                                profileToken,
                                translation: msg.translation,
                                speed
                            },
                            (err, result, xml) =>
                                utils.handleResult(node, err, result, xml, newMsg)
                        );
                        break;

                    case 'absoluteMove':
                        if (!msg.position) {
                            node.error('msg.position is required');
                            return;
                        }

                        node.deviceConfig.cam.absoluteMove(
                            {
                                profileToken,
                                position: msg.position,
                                speed
                            },
                            (err, result, xml) =>
                                utils.handleResult(node, err, result, xml, newMsg)
                        );
                        break;

                    case 'stop':
                        node.deviceConfig.cam.stop(
                            {
                                profileToken,
                                panTilt: true,
                                zoom: true
                            },
                            (err, result, xml) =>
                                utils.handleResult(node, err, result, xml, newMsg)
                        );
                        break;

                    case 'getStatus':
                        node.deviceConfig.cam.getStatus(
                            { profileToken },
                            (err, status, xml) =>
                                utils.handleResult(node, err, status, xml, newMsg)
                        );
                        break;

                    case 'getPresets':
                        node.deviceConfig.cam.getPresets(
                            { profileToken },
                            (err, presets, xml) =>
                                utils.handleResult(node, err, presets, xml, newMsg)
                        );
                        break;

                    case 'gotoPreset':
                        if (!msg.presetToken) {
                            node.error('msg.presetToken is required');
                            return;
                        }

                        node.deviceConfig.cam.gotoPreset(
                            {
                                profileToken,
                                presetToken: msg.presetToken,
                                speed
                            },
                            (err, result, xml) =>
                                utils.handleResult(node, err, result, xml, newMsg)
                        );
                        break;

                    case 'reconnect':
                        node.deviceConfig.cam.connect();
                        break;

                    default:
                        node.error(`Unsupported action: ${action}`);
                }
            } catch (err) {
                node.error(`Action failed: ${err.message}`);
            }
        });

        node.on('close', function () {
            if (node.listener) {
                node.deviceConfig?.removeListener('onvif_status', node.listener);
            }
        });
    }

    RED.nodes.registerType('onvif-ptz', OnVifPTZNode);
};
