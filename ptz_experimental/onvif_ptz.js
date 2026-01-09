/**
 * Original work:
 * Copyright 2018 Bart Butenaers
 *
 * Modifications:
 * Copyright 2025 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0
 */
'use strict';

const onvifCall = require('./onvifCall');

module.exports = function (RED) {

    function OnvifPtzNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);
        node.action = config.action;
        node.profileToken = config.profileToken;
        node.profileName = config.profileName;

        if (node.deviceConfig) {
            node.deviceConfig.initialize();
        }

        node.on('input', function (msg) {
            const action = msg.action || node.action;

            if (!action) {
                node.error('No PTZ action specified', msg);
                return;
            }

            if (!node.deviceConfig || !node.deviceConfig.cam) {
                node.error('Device not connected', msg);
                return;
            }

            /* --------------------------------------------------
             * Resolve ProfileToken (CACHED ONLY)
             * Priority:
             *   1) msg.ProfileToken
             *   2) node.profileToken
             *   3) profileName → cached lookup
             * -------------------------------------------------- */
            let profileToken =
                msg.profileToken ||   // Node-RED style
                msg.ProfileToken ||   // ONVIF style
                node.profileToken;


            if (!profileToken && node.profileName) {
                profileToken =
                    node.deviceConfig.getProfileTokenByName(node.profileName);
            }

            if (!profileToken) {
                node.error(
                    'ProfileToken is required for PTZ actions (cached profiles only)',
                    msg
                );
                node.status({ fill: 'red', shape: 'ring', text: 'missing profile' });
                return;
            }

            const params = { ProfileToken: profileToken };

            const num = (m, c) =>
                m !== undefined ? Number(m) : Number(c);

            /* --------------------------------------------------
             * PTZ Actions
             * -------------------------------------------------- */
            switch (action) {

                case 'continuousMove':
                    params.Velocity = {
                        PanTilt: {
                            x: num(msg.panSpeed, config.panSpeed) || 0,
                            y: num(msg.tiltSpeed, config.tiltSpeed) || 0
                        },
                        Zoom: {
                            x: num(msg.zoomSpeed, config.zoomSpeed) || 0
                        }
                    };

                    const t = msg.time ?? config.time;
                    if (t > 0) {
                        params.Timeout = `PT${t}S`;
                    }
                    break;

                case 'absoluteMove':
                    params.Position = {
                        PanTilt: {
                            x: num(msg.panPosition, config.panPosition) || 0,
                            y: num(msg.tiltPosition, config.tiltPosition) || 0
                        },
                        Zoom: {
                            x: num(msg.zoomPosition, config.zoomPosition) || 0
                        }
                    };

                    params.Speed = {
                        PanTilt: {
                            x: num(msg.panSpeed, config.panSpeed) || 0,
                            y: num(msg.tiltSpeed, config.tiltSpeed) || 0
                        },
                        Zoom: {
                            x: num(msg.zoomSpeed, config.zoomSpeed) || 0
                        }
                    };
                    break;

                case 'relativeMove':
                    params.Translation = {
                        PanTilt: {
                            x: num(msg.panTranslation, config.panTranslation) || 0,
                            y: num(msg.tiltTranslation, config.tiltTranslation) || 0
                        },
                        Zoom: {
                            x: num(msg.zoomTranslation, config.zoomTranslation) || 0
                        }
                    };
                    break;

                case 'gotoPreset':
                case 'setPreset':
                case 'removePreset':
                    params.PresetToken = msg.preset || config.preset;

                    if (!params.PresetToken) {
                        node.error('PresetToken is required', msg);
                        return;
                    }

                    if (action === 'setPreset') {
                        params.PresetName = msg.presetName || config.presetName;
                    }
                    break;

                case 'stop':
                    params.PanTilt =
                        msg.stopPanTilt !== undefined
                            ? !!msg.stopPanTilt
                            : !!config.stopPanTilt;

                    params.Zoom =
                        msg.stopZoom !== undefined
                            ? !!msg.stopZoom
                            : !!config.stopZoom;
                    break;

                case 'getPresets':
                case 'getStatus':
                case 'gotoHomePosition':
                case 'setHomePosition':
                    // ProfileToken only — nothing else required
                    break;

                default:
                    node.error(`Unsupported PTZ action: ${action}`, msg);
                    return;
            }

            onvifCall(node, {
                method: action,
                params,
                msg
            });
        });
    }

    RED.nodes.registerType('onvif-ptz', OnvifPtzNode);
};
