'use strict';

const onvifCall = require('./lib/onvifCall');

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

            let profileToken = msg.profileToken || node.profileToken;

            if (!profileToken && node.profileName) {
                profileToken = node.deviceConfig.getProfileTokenByName(
                    node.profileName
                );
            }

            const params = Object.assign({}, msg, {
                ProfileToken: profileToken,
                Name: node.profileName
            });

            onvifCall(node, {
                service: 'media',
                method: action,
                params,
                msg
            });
        });
    }

    RED.nodes.registerType('onvif-media-profile', OnvifMediaProfileNode);
};
