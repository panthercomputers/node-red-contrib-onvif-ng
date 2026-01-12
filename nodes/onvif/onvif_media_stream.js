/**
 * Copyright 2025–2026 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const onvifCall = require('./onvifCall');

module.exports = function (RED) {

    function OnvifMediaStreamNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        /* --------------------------------------------------
         * Configuration
         * -------------------------------------------------- */
        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);
        node.action       = config.action;
        node.profileName  = config.profileName;
        node.profileToken = config.profileToken;
        node.protocol     = config.protocol;
        node.stream       = config.stream;

        if (node.deviceConfig) {
            node.deviceConfig.initialize();
        }

        node.on('input', function (msg) {
            const action = msg.action || node.action;

            if (!action) {
                node.error('No media action specified', msg);
                return;
            }

            if (!node.deviceConfig) {
                node.error('No device configuration', msg);
                return;
            }

            /* --------------------------------------------------
             * RECONNECT (device-level)
             * -------------------------------------------------- */
            if (action === 'reconnect') {
                node.deviceConfig.initialize();
                msg.payload = { status: 'reconnecting' };
                node.send(msg);
                return;
            }

            if (!node.deviceConfig.cam) {
                node.error('Device not connected', msg);
                return;
            }

            /* --------------------------------------------------
             * Resolve ProfileToken (single source of truth)
             * -------------------------------------------------- */
            let profileToken =
                msg.profileToken ||      // Node-RED convention
                msg.ProfileToken ||      // ONVIF convention
                node.profileToken;       // Node config

            if (!profileToken && node.profileName) {
                profileToken =
                    node.deviceConfig.getProfileTokenByName(node.profileName);
            }

            if (!profileToken) {
                node.error(
                    `ProfileToken is required for media action: ${action}`,
                    msg
                );
                return;
            }

            /* --------------------------------------------------
             * Media call
             * NOTE: media methods live directly on cam
             * -------------------------------------------------- */
            const params = { ProfileToken: profileToken };

            if (node.protocol) {
                params.Protocol = node.protocol;
            }

            if (node.stream) {
                params.Stream = node.stream;
            }

            onvifCall(node, {
                method: action,
                params,
                msg
            });
        });
    }

    RED.nodes.registerType('onvif-media-stream', OnvifMediaStreamNode);
};
