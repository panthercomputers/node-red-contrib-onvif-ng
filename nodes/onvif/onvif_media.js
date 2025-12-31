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

    function OnVifMediaNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.profileToken = config.profileToken;
        node.profileName = config.profileName;
        node.protocol = config.protocol;
        node.stream = config.stream;

        node.snapshotUriMap = new Map();
        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);

        /* ---------- Status tracking ---------- */
        if (node.deviceConfig) {
            node.listener = (status) => {
                utils.setNodeStatus(node, 'media', status);
            };

            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'media', node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        /* ---------- SAFE SNAPSHOT FETCH ---------- */
        async function fetchSnapshot(uri, msg) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            try {
                const creds = node.deviceConfig?.credentials;
                if (!creds?.user || !creds?.password) {
                    node.error('Camera credentials missing');
                    return;
                }

                const auth = Buffer
                    .from(`${creds.user}:${creds.password}`)
                    .toString('base64');

                const res = await fetch(uri, {
                    headers: { Authorization: `Basic ${auth}` },
                    signal: controller.signal
                });

                if (!res.ok) {
                    node.error(`Snapshot HTTP ${res.status}`);
                    return;
                }

                msg.payload = Buffer.from(await res.arrayBuffer());
                msg.contentType =
                    res.headers.get('content-type') || 'image/jpeg';

                node.send(msg);
            }
            catch (err) {
                if (err.name !== 'AbortError') {
                    node.error(`Snapshot fetch failed: ${err.message}`);
                }
            }
            finally {
                clearTimeout(timeout);
            }
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
                if (!utils.hasService(node.deviceConfig.cam, 'media')) {
                    node.error('Media service not supported');
                    return;
                }
            }

            const profileToken =
                node.profileToken ||
                msg.profileToken ||
                (node.profileName
                    ? node.deviceConfig.getProfileTokenByName(node.profileName)
                    : undefined);

            const newMsg = {
                ...msg,
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            switch (action) {

                /* ---------- STREAM URI ---------- */
                case 'getStreamUri':
                    onvifCall(node, {
                        service: 'media',
                        method: 'getStreamUri',
                        args: [{
                            stream: node.stream || msg.stream,
                            protocol: node.protocol || msg.protocol,
                            profileToken
                        }],
                        msg: newMsg,
                        onSuccess: (data, xml) =>
                            utils.handleResult(node, null, data, xml, newMsg)
                    });
                    break;

                /* ---------- SNAPSHOT URI ---------- */
                case 'getSnapshotUri':
                    onvifCall(node, {
                        service: 'media',
                        method: 'getSnapshotUri',
                        args: [{ profileToken }],
                        msg: newMsg,
                        onSuccess: (data, xml) =>
                            utils.handleResult(node, null, data, xml, newMsg)
                    });
                    break;

                /* ---------- SNAPSHOT IMAGE ---------- */
                case 'getSnapshot': {
                    const cached = node.snapshotUriMap.get(profileToken);
                    if (cached) {
                        fetchSnapshot(cached, newMsg);
                        return;
                    }

                    onvifCall(node, {
                        service: 'media',
                        method: 'getSnapshotUri',
                        args: [{ profileToken }],
                        msg: newMsg,
                        onSuccess: (data) => {
                            if (!data?.uri) {
                                node.error('No snapshot URI returned');
                                return;
                            }
                            node.snapshotUriMap.set(profileToken, data.uri);
                            fetchSnapshot(data.uri, newMsg);
                        }
                    });
                    break;
                }

                /* ---------- PROFILES ---------- */
                case 'getProfiles':
                    onvifCall(node, {
                        service: 'media',
                        method: 'getProfiles',
                        msg: newMsg,
                        onSuccess: (data, xml) =>
                            utils.handleResult(node, null, data, xml, newMsg)
                    });
                    break;

                /* ---------- RECONNECT ---------- */
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

    RED.nodes.registerType('onvif-media', OnVifMediaNode);
};

