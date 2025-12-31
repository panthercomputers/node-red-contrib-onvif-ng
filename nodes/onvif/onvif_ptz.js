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
    const onvifCall = require('onvifCall');
    const utils = require('utils');

    function OnVifPtzNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.profileToken = config.profileToken;
        node.profileName = config.profileName;

        node.pan = Number(config.pan);
        node.tilt = Number(config.tilt);
        node.zoom = Number(config.zoom);
        node.speed = Number(config.speed) || 0.5;
        node.timeout = Number(config.timeout) || 1.5;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        /* ---------- STATUS TRACKING ---------- */
        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, 'ptz', status);
            };
            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'ptz', node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        /* ---------- INPUT ---------- */
        node.on('input', function (msg) {
            const action = node.action || msg.action;
            if (!action) {
                node.error('No action specified', msg);
                return;
            }

            if (action !== 'reconnect') {
                if (!node.deviceConfig || node.deviceConfig.onvifStatus !== 'connected') {
                    node.error('Not connected to device');
                    return;
                }
                if (!utils.hasService(node.deviceConfig.cam, 'ptz')) {
                    node.error('PTZ service not supported');
                    return;
                }
            }

            const profileToken =
                node.profileToken ||
                msg.profileToken ||
                (node.profileName
                    ? node.deviceConfig.getProfileTokenByName(node.profileName)
                    : undefined);

            if (!profileToken && action !== 'reconnect') {
                node.error('Missing profileToken');
                return;
            }

            const pan = Number(msg.pan ?? node.pan);
            const tilt = Number(msg.tilt ?? node.tilt);
            const zoom = Number(msg.zoom ?? node.zoom);
            const speed = Number(msg.speed ?? node.speed);
            const timeout = Number(msg.timeout ?? node.timeout);

            const newMsg = {
                ...msg,
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            /* ---------- ACTIONS ---------- */
            switch (action) {

                case 'getStatus':
                    onvifCall(node, {
                        service: 'ptz',
                        method: 'getStatus',
                        args: [profileToken],
                        msg: newMsg
                    });
                    break;

                case 'getPresets':
                    onvifCall(node, {
                        service: 'ptz',
                        method: 'getPresets',
                        args: [profileToken],
                        msg: newMsg
                    });
                    break;

                case 'gotoPreset':
                    if (!msg.presetToken) {
                        node.error('Missing presetToken');
                        return;
                    }
                    onvifCall(node, {
                        service: 'ptz',
                        method: 'gotoPreset',
                        args: [profileToken, msg.presetToken],
                        msg: newMsg
                    });
                    break;

                case 'absoluteMove':
                    onvifCall(node, {
                        service: 'ptz',
                        method: 'absoluteMove',
                        args: [
                            profileToken,
                            { x: pan, y: tilt, zoom },
                            { x: speed, y: speed, zoom: speed }
                        ],
                        msg: newMsg
                    });
                    break;

                case 'relativeMove':
                    onvifCall(node, {
                        service: 'ptz',
                        method: 'relativeMove',
                        args: [
                            profileToken,
                            { x: pan, y: tilt, zoom },
                            { x: speed, y: speed, zoom: speed }
                        ],
                        msg: newMsg
                    });
                    break;

                case 'continuousMove':
                    onvifCall(node, {
                        service: 'ptz',
                        method: 'continuousMove',
                        args: [
                            profileToken,
                            { x: pan, y: tilt, zoom }
                        ],
                        msg: newMsg,
                        onSuccess: () => {
                            /* Safety stop */
                            setTimeout(() => {
                                onvifCall(node, {
                                    service: 'ptz',
                                    method: 'stop',
                                    args: [profileToken],
                                    allowDisconnected: true
                                });
                            }, timeout * 1000);
                        }
                    });
                    break;

                case 'stop':
                    onvifCall(node, {
                        service: 'ptz',
                        method: 'stop',
                        args: [profileToken],
                        msg: newMsg
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

        /* ---------- CLEANUP ---------- */
        node.on('close', function () {
            if (node.listener && node.deviceConfig) {
                node.deviceConfig.removeListener('onvif_status', node.listener);
            }
        });
    }

    RED.nodes.registerType('onvif-ptz', OnVifPtzNode);
};


