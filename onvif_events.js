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
    const onvifCall = require('./onvif/onvifCall');
    const utils = require('./onvif/utils');

    function OnVifEventsNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.action = config.action;
        node.deviceConfig = RED.nodes.getNode(config.deviceConfig);
        node.eventListener = null;

        /* ---------- STATUS TRACKING ---------- */
        if (node.deviceConfig) {
            node.listener = (status) => {
                if (status !== 'connected' && node.eventListener) {
                    stopListening();
                }
                utils.setNodeStatus(
                    node,
                    'event',
                    node.eventListener ? 'listening' : status
                );
            };

            node.deviceConfig.addListener('onvif_status', node.listener);
            utils.setNodeStatus(node, 'event', node.deviceConfig.onvifStatus);
            node.deviceConfig.initialize();
        }

        /* ---------- EVENT NORMALIZATION ---------- */
        function normalizeEvent(camMessage) {
            try {
                const msg = camMessage?.message?.message;
                if (!msg) return null;

                /* Topic cleanup (strip namespaces) */
                let topic = camMessage.topic?._ || '';
                topic = topic
                    .split('/')
                    .map(p => p.split(':').pop())
                    .join('/');

                const out = {
                    topic,
                    time: msg.$?.UtcTime,
                    property: msg.$?.PropertyOperation
                };

                /* Source */
                const source = msg.source?.simpleItem;
                if (source) {
                    const s = Array.isArray(source) ? source[0] : source;
                    out.source = {
                        name: s.$?.Name,
                        value: s.$?.Value
                    };
                }

                /* Data */
                const data = msg.data;
                if (data?.simpleItem) {
                    const items = Array.isArray(data.simpleItem)
                        ? data.simpleItem
                        : [data.simpleItem];

                    out.data = items.map(i => ({
                        name: i.$?.Name,
                        value: i.$?.Value
                    }));
                }
                else if (data?.elementItem) {
                    out.data = data.elementItem;
                }

                return out;
            }
            catch (err) {
                node.warn(`Failed to parse event: ${err.message}`);
                return null;
            }
        }

        /* ---------- START LISTENING ---------- */
        function startListening() {
            if (node.eventListener) {
                node.warn('Already listening for events');
                return;
            }

            node.eventListener = (camMessage) => {
                const out = normalizeEvent(camMessage);
                if (out) {
                    node.send(out);
                }
            };

            node.deviceConfig.cam.on('event', node.eventListener);
            utils.setNodeStatus(node, 'event', 'listening');
        }

        /* ---------- STOP LISTENING ---------- */
        function stopListening() {
            if (!node.eventListener) return;

            try {
                node.deviceConfig.cam.removeListener('event', node.eventListener);
            } catch (_) {}

            node.eventListener = null;
            utils.setNodeStatus(node, 'event', 'connected');
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
                if (!utils.hasService(node.deviceConfig.cam, 'event')) {
                    node.error('Event service not supported');
                    return;
                }
            }

            const newMsg = {
                ...msg,
                action,
                xaddr: node.deviceConfig?.xaddress
            };

            switch (action) {

                case 'start':
                    startListening();
                    break;

                case 'stop':
                    stopListening();
                    break;

                case 'getEventProperties':
                    onvifCall(node, {
                        service: 'event',
                        method: 'getEventProperties',
                        msg: newMsg,
                        onSuccess: (data, xml) =>
                            utils.handleResult(node, null, data, xml, newMsg)
                    });
                    break;

                case 'getEventServiceCapabilities':
                    onvifCall(node, {
                        service: 'event',
                        method: 'getEventServiceCapabilities',
                        msg: newMsg,
                        onSuccess: (data, xml) =>
                            utils.handleResult(node, null, data, xml, newMsg)
                    });
                    break;

                case 'reconnect':
                    stopListening();
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
            stopListening();
            if (node.listener && node.deviceConfig) {
                node.deviceConfig.removeListener('onvif_status', node.listener);
            }
        });
    }

    RED.nodes.registerType('onvif-events', OnVifEventsNode);
};
