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
    const onvif = require("onvif");

    function OnVifDiscoveryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.timeout = Math.max(Number(config.timeout) || 5, 1) * 1000;
        node.separate = !!config.separate;
        node.discovering = false;

        /* ---------------------------------------------------------
         * Normalize ONVIF discovery result
         * --------------------------------------------------------- */
        function simplifyResult(result) {
            if (!result?.probeMatches?.probeMatch) {
                return null;
            }

            const pm = result.probeMatches.probeMatch;

            const normalize = (v) =>
                typeof v === "string" ? v.trim().split(/\s+/) : v;

            return {
                urn: pm.endpointReference?.address || null,
                types: normalize(pm.types),
                scopes: normalize(pm.scopes),
                xaddrs: normalize(pm.XAddrs),
                metadataVersion: pm.metadataVersion
            };
        }

        /* ---------------------------------------------------------
         * Input handler
         * --------------------------------------------------------- */
        node.on("input", function (msg) {
            if (node.discovering) {
                node.warn("Discovery already in progress");
                return;
            }

            node.discovering = true;
            node.status({ fill: "yellow", shape: "dot", text: "discovering" });

            const options = {
                timeout: node.timeout,
                resolve: false
            };

            /* IMPORTANT:
             * Discovery is global/static in onvif lib
             * Remove previous listeners to avoid leaks
             */
            onvif.Discovery.removeAllListeners("device");
            onvif.Discovery.removeAllListeners("error");

            const results = [];

            if (node.separate) {
                onvif.Discovery.on("device", (result) => {
                    const simplified = simplifyResult(result);
                    if (!simplified) {
                        return;
                    }

                    const out = RED.util.cloneMessage(msg);
                    out.payload = simplified;
                    node.send(out);
                });
            }

            onvif.Discovery.once("error", (err) => {
                node.error(`Discovery error: ${err.message || err}`);
            });

            onvif.Discovery.probe(options, (err, result) => {
                try {
                    if (err) {
                        node.error(err.message || err);
                        node.status({ fill: "red", shape: "dot", text: "failed" });
                        return;
                    }

                    const devices = Array.isArray(result)
                        ? result
                              .map(simplifyResult)
                              .filter(Boolean)
                        : [];

                    if (!node.separate) {
                        const out = RED.util.cloneMessage(msg);
                        out.payload = devices;
                        node.send(out);
                    }

                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: `completed (${devices.length})`
                    });
                }
                finally {
                    node.discovering = false;
                    onvif.Discovery.removeAllListeners("device");
                    onvif.Discovery.removeAllListeners("error");
                }
            });
        });

        /* ---------------------------------------------------------
         * Cleanup
         * --------------------------------------------------------- */
        node.on("close", function () {
            node.discovering = false;
            node.status({});
            onvif.Discovery.removeAllListeners("device");
            onvif.Discovery.removeAllListeners("error");
        });
    }

    /* 🔴 CRITICAL FIX:
     * Original file registered WRONG node type
     */
    RED.nodes.registerType("onvif-discovery", OnVifDiscoveryNode);
};
