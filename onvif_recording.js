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
    const utils = require('./utils');

    function OnVifRecordingNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        /**
         * Status listener for device state changes
         */
        if (node.deviceConfig) {
            node.statusListener = function (onvifStatus) {
                utils.setNodeStatus(node, 'recording', onvifStatus);
            };

            node.deviceConfig.on('onvif_status', node.statusListener);

            // Show current status immediately
            utils.setNodeStatus(node, 'recording', node.deviceConfig.onvifStatus);

            node.deviceConfig.initialize();
        }

        /**
         * Input handler
         */
        node.on('input', function (msg) {
            if (!node.deviceConfig || node.deviceConfig.onvifStatus !== 'connected') {
                node.error('This node is not connected to a device', msg);
                return;
            }

            const cam = node.deviceConfig.cam;

            if (!utils.hasService(cam, 'recording')) {
                node.error('The device does not support the ONVIF Recording service', msg);
                return;
            }

            const outMsg = RED.util.cloneMessage(msg);
            outMsg.xaddr = node.deviceConfig.xaddress;

            try {
                cam.getRecordings(function (err, recordings, xml) {
                    utils.handleResult(node, err, recordings, xml, outMsg);
                });
            } catch (err) {
                node.error('getRecordings failed: ' + err.message, msg);
            }
        });

        /**
         * Cleanup
         */
        node.on('close', function () {
            if (node.deviceConfig && node.statusListener) {
                node.deviceConfig.removeListener('onvif_status', node.statusListener);
            }
            node.status({});
        });
    }

    RED.nodes.registerType('onvif-recording', OnVifRecordingNode);
};
