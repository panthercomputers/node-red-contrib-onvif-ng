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

const { Cam } = require('onvif');

module.exports = function (RED) {

    function OnvifConfigNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;

        node.xaddress = config.xaddress;
        node.port = config.port || 80;
        node.secure = config.secure || false;

        // Device fingerprint (used for portability & safety)
        node.deviceKey = `${node.xaddress}:${node.port}`;

        // ---- Portable authentication resolution ----
        const envKey = node.xaddress
            ? node.xaddress.replace(/\./g, '_')
            : null;

        node.user =
            node.credentials?.user ||
            (envKey && process.env[`ONVIF_CAM_${envKey}_USER`]) ||
            process.env.ONVIF_USER ||
            null;

        node.password =
            node.credentials?.password ||
            (envKey && process.env[`ONVIF_CAM_${envKey}_PASS`]) ||
            process.env.ONVIF_PASS ||
            null;

        // Fail fast if credentials are missing
        if (!node.user || !node.password) {
            node.warn(
                `ONVIF credentials missing for ${node.deviceKey}. ` +
                `Set credentials in config node or environment variables.`
            );
            return;
        }

        // ---- Create ONVIF camera instance ----
        try {
            node.cam = new Cam({
                hostname: node.xaddress,
                port: node.port,
                username: node.user,
                password: node.password,
                secure: node.secure,
                timeout: 8000
            }, function (err) {
                if (err) {
                    node.onvifStatus = 'error';
                    node.error(`ONVIF connection failed: ${err.message || err}`);
                } else {
                    node.onvifStatus = 'connected';
                    node.log(`ONVIF connected: ${node.deviceKey}`);
                }
            });
        } catch (err) {
            node.onvifStatus = 'error';
            node.error(`ONVIF init exception: ${err.message}`);
        }

        node.on('close', function () {
            node.cam = null;
            node.onvifStatus = 'disconnected';
        });
    }

    RED.nodes.registerType('onvif-config', OnvifConfigNode, {
        credentials: {
            user: { type: 'text' },
            password: { type: 'password' }
        }
    });
};
