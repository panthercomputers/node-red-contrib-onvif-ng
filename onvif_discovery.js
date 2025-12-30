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
    const onvif = require('onvif');

    function simplifyResult(result) {
        const pm = result.probeMatches.probeMatch;

        if (typeof pm.types === 'string') pm.types = pm.types.trim().split(' ');
        if (typeof pm.scopes === 'string') pm.scopes = pm.scopes.trim().split(' ');
        if (typeof pm.XAddrs === 'string') pm.XAddrs = pm.XAddrs.trim().split(' ');

        return pm;
    }

    function OnVifDiscoveryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.timeout = Number(config.timeout) * 1000 || 5000;
        node.separate = config.separate;
        node.discovering = false;

        node.on('input', msg => {
            if (node.discovering) return;

            node.discovering = true;
            node.status({ fill: 'yellow', shape: 'dot', text: 'discovering' });

            onvif.Discovery.removeAllListeners();

            if (node.separate) {
                onvif.Discovery.on('device', result => {
                    const m = RED.util.cloneMessage(msg);
                    m.payload = simplifyResult(result);
                    node.send(m);
                });
            }

            onvif.Discovery.on('error', err =>
                node.error(`Discovery error: ${err}`)
            );

            onvif.Discovery.probe(
                { timeout: node.timeout, resolve: false },
                (err, result) => {
                    if (err) {
                        node.error(err.message);
                        node.status({ fill: 'red', shape: 'dot', text: 'failed' });
                    } else {
                        node.status({
                            fill: 'green',
                            shape: 'dot',
                            text: `completed (${result.length})`
                        });
                    }

                    if (!node.separate && result) {
                        msg.payload = result.map(simplifyResult);
                        node.send(msg);
                    }

                    node.discovering = false;
                }
            );
        });

        node.on('close', () => {
            onvif.Discovery.removeAllListeners();
            node.status({});
            node.discovering = false;
        });
    }

    RED.nodes.registerType('onvif-discovery', OnVifDiscoveryNode);
};
