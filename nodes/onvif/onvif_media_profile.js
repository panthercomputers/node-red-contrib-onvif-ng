<!--
  Copyright 2025 Panther Computers

  Licensed under the Apache License, Version 2.0
-->

'use strict';

const onvifCall = require('./onvifCall');

module.exports = function (RED) {

    function OnvifMediaProfileNode(config) {
        RED.nodes.createNode(this, config);

        this.deviceConfig = RED.nodes.getNode(config.deviceConfig);
        this.action = config.action;
        this.profileName = config.profileName;
        this.profileToken = config.profileToken;

        const node = this;

        if (this.deviceConfig) {
            this.deviceConfig.initialize();
        }

        node.on('input', function (msg) {
            const action = msg.action || node.action;

            if (!action) {
                node.error('No action specified', msg);
                return;
            }

            if (!node.deviceConfig) {
                node.error('No device configuration', msg);
                return;
            }

            let params = {};

            // Resolve profile token only when required
            if (action !== 'getProfiles') {
                let profileToken = msg.profileToken || node.profileToken;

                if (!profileToken && node.profileName) {
                    profileToken =
                        node.deviceConfig.getProfileTokenByName(node.profileName);
                }

                if (!profileToken) {
                    node.error('No profile token resolved', msg);
                    return;
                }

                params.ProfileToken = profileToken;
            }

            onvifCall(node, {
                service: null,              // media methods are on cam directly
                method: action,
                params,
                msg
            });
        });
    }

    RED.nodes.registerType('onvif-media-profile', OnvifMediaProfileNode);
};
