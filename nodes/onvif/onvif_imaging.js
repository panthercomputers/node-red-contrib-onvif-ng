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

    function OnVifImagingNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.profileToken = config.profileToken;
        node.profileName = config.profileName;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        if (node.deviceConfig) {
            node.listener = status =>
                utils.setNodeStatus(node, 'imaging', status);

            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'imaging', node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        node.on('input', msg => {
            const action = node.action || msg.action;
            if (!action) {
                node.error('No action specified');
                return;
            }

            if (!node.deviceConfig || node.deviceConfig.onvifStatus !== 'connected') {
                node.error('Not connected to device');
                return;
            }

            if (!utils.hasService(node.deviceConfig.cam, 'imaging')) {
                node.error('Imaging service not supported');
                return;
            }

            const profileToken =
                node.profileToken ||
                msg.profileToken ||
                (node.profileName
                    ? node.deviceConfig.getProfileTokenByName(node.profileName)
                    : undefined);

            if (!profileToken) {
                node.error('Missing profileToken');
                return;
            }

            const newMsg = {
                ...msg,
                action,
                xaddr: node.deviceConfig.xaddress
            };

            switch (action) {

                case 'getSettings':
                    onvifCall(node, {
                        service: 'imaging',
                        method: 'getImagingSettings',
                        args: [profileToken],
                        msg: newMsg
                    });
                    break;

                case 'setSettings':
                    if (!msg.settings) {
                        node.error('Missing msg.settings');
                        return;
                    }
                    onvifCall(node, {
                        service: 'imaging',
                        method: 'setImagingSettings',
                        args: [profileToken, msg.settings, true],
                        msg: newMsg
                    });
                    break;

                default:
                    node.error(`Unsupported action: ${action}`);
            }
        });

        node.on('close', () => {
            if (node.listener) {
                node.deviceConfig.removeListener('onvif_status', node.listener);
            }
        });
    }

    RED.nodes.registerType('onvif-imaging', OnVifImagingNode);
};
