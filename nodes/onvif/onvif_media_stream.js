/**
 * Copyright 2025 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const onvifCall = require('./lib/onvifCall');

module.exports = function (RED) {

    function OnvifMediaStreamNode(config) {
        RED.nodes.createNode(this, config);

        this.deviceConfig = RED.nodes.getNode(config.deviceConfig);
        this.action = config.action;
        this.profileName = config.profileName;
        this.protocol = config.protocol;
        this.stream = config.stream;

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

            if (action === 'reconnect') {
                node.deviceConfig.initialize();
                msg.payload = { status: 'reconnecting' };
                node.send(msg);
                return;
            }

            let profileToken = msg.profileToken;

            if (!profileToken && node.profileName) {
                profileToken = node.deviceConfig.getProfileTokenByName(
                    node.profileName
                );
            }

            const params = Object.assign({}, msg, {
                ProfileToken: profileToken,
                Protocol: node.protocol,
                Stream: node.stream
            });

            onvifCall(node, {
                service: 'media',
                method: action,
                params,
                msg
            });
        });
    }

    RED.nodes.registerType('onvif-media-stream', OnvifMediaStreamNode);
};
