/**
 * Original work:
 * Copyright 2018 Bart Butenaers
 *
 * Modifications:
 * Copyright 2025 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

module.exports = function (RED) {
    const onvif = require('onvif');

    function OnVifDiscoveryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.timeout = Number(config.timeout || 5) * 1000; // seconds → ms
        node.separate = !!config.separate;
        node.discovering = false;

        /**
         * Simplify discovery results for Node-RED consumption
         */
        function simplifyResult(result) {
            if (!result?.probeMatches?.probeMatch) {
                return null;
            }

            const probeMatch = result.probeMatches.probeMatch;

            if (typeof probeMatch.types === 'string') {
                probeMatch.types = probeMatch.types.trim().split(/\s+/);
            }

            if (typeof probeMatch.scopes === 'string') {
                probeMatch.scopes = probeMatch.scopes.trim().split(/\s+/);
            }

            if (typeof probeMatch.XAddrs === 'string') {
                probeMatch.XAddrs = probeMatch.XAddrs.trim().split(/\s+/);
            }

            return probeMatch;
        }

        /**
         * Input handler
         */
        node.on('input', function (msg) {
            if (node.discovering) {
                node.warn('Discovery already in progress, request ignored');
                return;
            }

            node.discovering = true;
            node.status({ fill: 'yellow', shape: 'dot', text: 'discovering' });

            const options = {
                timeout: node.timeout,
                resolve: false // return raw device data, not Cam instances
            };

            // Clean up any previous listeners (VERY IMPORTANT)
            onvif.Discovery.removeAllListeners();

            /**
             * Per-device output mode
             */
            if (node.separate) {
                onvif.Discovery.on('device', function (result) {
                    const simplified = simplifyResult(result);
                    if (!simplified) {
                        return;
                    }

                    const outMsg = RED.util.cloneMessage(msg);
                    outMsg.payload = simplified;
                    node.send(outMsg);
                });
            }

            /**
             * Error handler (malformed SOAP responses, UDP noise, etc.)
             */
            onvif.Discovery.on('error', function (err) {
                node.error('ONVIF discovery error: ' + err.message);
            });

            /**
             * Start discovery
             */
            onvif.Discovery.probe(options, function (err, results) {
                try {
                    if (err) {
                        node.error(err.message);
                        node.status({ fill: 'red', shape: 'dot', text: 'failed' });
                        return;
                    }

                    node.status({
                        fill: 'green',
                        shape: 'dot',
                        text: `completed (${results.length})`
                    });

                    if (!node.separate) {
                        const devices = [];

                        for (const result of results) {
                            const simplified = simplifyResult(result);
                            if (simplified) {
                                devices.push(simplified);
                            }
                        }

                        const outMsg = RED.util.cloneMessage(msg);
                        outMsg.payload = devices;
                        node.send(outMsg);
                    }
                } finally {
                    node.discovering = false;
                }
            });
        });

        /**
         * Cleanup
         */
        node.on('close', function () {
            node.status({});
            node.discovering = false;
            onvif.Discovery.removeAllListeners();
        });
    }

    RED.nodes.registerType('onvif-discovery', OnVifDiscoveryNode);
};
