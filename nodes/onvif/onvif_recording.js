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
    const onvifCall = require('./onvif/onvifCall');
    const utils = require('./onvif/utils');

    function OnVifRecordingNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = status =>
                utils.setNodeStatus(node, 'recording', status);

            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'recording', node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        node.on('input', msg => {
            if (!node.deviceConfig || node.deviceConfig.onvifStatus !== 'connected') {
                node.error('Not connected to device');
                return;
            }

            if (!utils.hasService(node.deviceConfig.cam, 'recording')) {
                node.error('Recording service not supported');
                return;
            }

            onvifCall(node, {
                service: 'recording',
                method: 'getRecording',
                msg: {
                    ...msg,
                    xaddr: node.deviceConfig.xaddress
                }
            });
        });

        node.on('close', () => {
            if (node.listener) {
                node.deviceConfig.removeListener('onvif_status', node.listener);
            }
        });
    }

    RED.nodes.registerType('onvif-recording', OnVifRecordingNode);
};
