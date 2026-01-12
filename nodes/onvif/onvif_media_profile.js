/**
 * Copyright 2025–2026 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const onvifCall = require('./onvifCall');

module.exports = function (RED) {

    function OnvifMediaProfileNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        /* --------------------------------------------------
         * Configuration
         * -------------------------------------------------- */
        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);
        node.action       = config.action;
        node.profileName  = config.profileName;
        node.profileToken = config.profileToken;

        if (node.deviceConfig) {
            node.deviceConfig.initialize();
        }

        node.on('input', function (msg) {
            const action = msg.action || node.action;

            if (!action) {
                node.error('No media profile action specified', msg);
                return;
            }

            if (!node.deviceConfig || !node.deviceConfig.cam) {
                node.error('Device not connected', msg);
                return;
            }

            /* --------------------------------------------------
             * Actions that do NOT require a ProfileToken
             * -------------------------------------------------- */
            const noProfileRequired = new Set([
                'getProfiles'
            ]);

            const params = {};

            if (!noProfileRequired.has(action)) {
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
                        `ProfileToken is required for media profile action: ${action}`,
                        msg
                    );
                    return;
                }

                params.ProfileToken = profileToken;
            }

            /* --------------------------------------------------
             * Media Profile call
             * NOTE: profile methods live directly on cam
             * -------------------------------------------------- */
            onvifCall(node, {
                method: action,
                params,
                msg
            });
        });
    }

    RED.nodes.registerType('onvif-media-profile', OnvifMediaProfileNode);
};
