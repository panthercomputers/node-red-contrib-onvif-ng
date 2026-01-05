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
    function OnvifPTZNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        node.on('input', function (msg) {
            const action = msg.action || config.action;
            const profile = msg.profile || config.profile;

            if (!action) {
                node.error('PTZ action is required', msg);
                return;
            }

            if (!profile) {
                node.error('ProfileToken is required for PTZ actions', msg);
                return;
            }

            let params = { ProfileToken: profile };

            switch (action) {

                case 'continuousMove':
                    if (!msg.velocity) {
                        node.error('continuousMove requires msg.velocity', msg);
                        return;
                    }

                    params.Velocity = normalizeVelocity(msg.velocity, node, msg);
                    if (!params.Velocity) return;

                    params.Timeout = msg.timeout || 1;
                    break;

                case 'stop':
                    params.PanTilt = msg.panTilt !== false;
                    params.Zoom = msg.zoom !== false;
                    break;

                case 'gotoPreset':
                    if (!msg.presetToken) {
                        node.error('gotoPreset requires msg.presetToken', msg);
                        return;
                    }
                    params.PresetToken = msg.presetToken;

                    if (msg.speed) {
                        params.Speed = normalizeSpeed(msg.speed, node, msg);
                        if (!params.Speed) return;
                    }
                    break;

                case 'getPresets':
                case 'getStatus':
                    // no extra params
                    break;

                case 'setPreset':
                    if (msg.presetName) {
                        params.PresetName = msg.presetName;
                    }
                    break;

                case 'removePreset':
                    if (!msg.presetToken) {
                        node.error('removePreset requires msg.presetToken', msg);
                        return;
                    }
                    params.PresetToken = msg.presetToken;
                    break;

                default:
                    node.error(`Unknown PTZ action: ${action}`, msg);
                    return;
            }

            onvifCall(node, {
                service: 'ptz',
                method: action,
                params,
                msg
            });
        });
    }

    RED.nodes.registerType('onvif-ptz', OnvifPTZNode);
};

// ---------- helpers ----------

function normalizeVelocity(v, node, msg) {
    if (typeof v !== 'object') {
        node.error('Velocity must be an object', msg);
        return null;
    }

    const clamp = (n) => Math.max(-1, Math.min(1, Number(n)));

    return {
        PanTilt: v.PanTilt ? {
            x: clamp(v.PanTilt.x),
            y: clamp(v.PanTilt.y)
        } : undefined,
        Zoom: v.Zoom ? {
            x: clamp(v.Zoom.x)
        } : undefined
    };
}

function normalizeSpeed(v, node, msg) {
    return normalizeVelocity(v, node, msg);
}
