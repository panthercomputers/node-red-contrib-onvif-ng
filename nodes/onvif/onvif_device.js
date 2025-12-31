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
    const onvifCall = require('./onvifCall');
    const utils = require('./utils');

    function OnVifDeviceNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, 'device', status);
            };

            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'device', node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        node.on('input', function (msg) {
            const action = node.action || msg.action;
            if (!action) {
                node.error('No action specified', msg);
                return;
            }

            const newMsg = {
                ...msg,
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            switch (action) {
                case 'getDeviceInformation':
                case 'getHostname':
                case 'getSystemDateAndTime':
                case 'getScopes':
                case 'systemReboot':
                case 'getCapabilities':
                    onvifCall(node, {
                        service: 'device',
                        method: action,
                        msg: newMsg,
                        onSuccess: (data, xml) =>
                            utils.handleResult(node, null, data, xml, newMsg)
                    });
                    break;

                case 'reconnect':
                    onvifCall(node, {
                        allowDisconnected: true,
                        method: 'connect',
                        msg: newMsg
                    });
                    break;

                default:
                    node.error(`Unsupported action: ${action}`, msg);
            }
        });

        node.on('close', function () {
            if (node.listener && node.deviceConfig) {
                node.deviceConfig.removeListener('onvif_status', node.listener);
            }
        });
    }

    RED.nodes.registerType('onvif-device', OnVifDeviceNode);
};

