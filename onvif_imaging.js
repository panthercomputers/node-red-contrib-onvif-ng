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

    function OnVifImagingNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.videoSourceToken = config.videoSourceToken;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, 'imaging', status);
            };

            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'imaging', node.deviceConfig.onvifStatus);
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

                if (!utils.hasService(node.deviceConfig.cam, 'imaging')) {
                    node.error('Imaging service not supported by device');
                    return;
                }
            }

            const videoSourceToken =
                node.videoSourceToken ||
                msg.videoSourceToken ||
                node.deviceConfig?.videoSourceToken;

            const newMsg = {
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            try {
                switch (action) {
                    case 'getImagingSettings':
                        node.deviceConfig.cam.getImagingSettings(
                            { videoSourceToken },
                            (err, settings, xml) =>
                                utils.handleResult(node, err, settings, xml, newMsg)
                        );
                        break;

                    case 'setImagingSettings':
                        if (!msg.settings) {
                            node.error('msg.settings is required');
                            return;
                        }

                        node.deviceConfig.cam.setImagingSettings(
                            {
                                videoSourceToken,
                                imagingSettings: msg.settings,
                                forcePersistence: true
                            },
                            (err, result, xml) =>
                                utils.handleResult(node, err, result, xml, newMsg)
                        );
                        break;

                    case 'getOptions':
                        node.deviceConfig.cam.getOptions(
                            { videoSourceToken },
                            (err, options, xml) =>
                                utils.handleResult(node, err, options, xml, newMsg)
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

    RED.nodes.registerType('onvif-imaging', OnVifImagingNode);
};
