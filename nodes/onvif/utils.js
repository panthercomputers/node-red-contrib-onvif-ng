/**
 * Original work:
 * Copyright 2018 Bart Butenaers
 *
 * Modernized status semantics:
 * Copyright 2025–2026 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0
 */

const DISCOVERY_SERVICES = new Set([
    "events",
    "recording",
    "analytics",
    "device"
]);

exports.setNodeStatus = function (node, serviceName, onvifStatus) {
    switch (onvifStatus) {
        case "unconfigured":
            node.status({ fill: "grey", shape: "ring", text: "not configured" });
            break;

        case "initializing":
            node.status({ fill: "yellow", shape: "ring", text: "connecting" });
            break;

        case "disconnected":
            node.status({ fill: "red", shape: "ring", text: "disconnected" });
            break;

        case "connected":
            // Discovery nodes: never pre-judge support
            if (DISCOVERY_SERVICES.has(serviceName)) {
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "ready (discovery)"
                });
                return;
            }

            // Control/action nodes: strict service validation
            if (node.deviceConfig?.cam) {
                if (exports.hasService(node.deviceConfig.cam, serviceName)) {
                    node.status({ fill: "green", shape: "dot", text: "connected" });
                } else {
                    node.status({ fill: "red", shape: "ring", text: "unsupported" });
                }
            } else {
                node.status({ fill: "red", shape: "ring", text: "no device" });
            }
            break;

        case "listening":
            node.status({ fill: "green", shape: "dot", text: "listening" });
            break;

        case "":
            node.status({});
            break;

        default:
            node.status({ fill: "red", shape: "ring", text: "unknown" });
    }
};

exports.handleResult = function (node, err, date, xml, newMsg) {
    if (err) {
        node.error(err.message);

        if (newMsg?.action === "reconnect") {
            node.status({ fill: "red", shape: "ring", text: "disconnected" });
        }
    } else {
        if (newMsg) {
            newMsg.payload = date;
            node.send(newMsg);
        }

        if (newMsg?.action === "reconnect") {
            node.status({ fill: "green", shape: "dot", text: "connected" });
        }
    }
};

exports.hasService = function (cam, serviceName) {
    if (!cam) return false;

    if (cam.services) {
        return cam.services.some(service =>
            service.XAddr &&
            service.XAddr.toLowerCase().includes(serviceName.toLowerCase())
        );
    }

    if (cam.capabilities) {
        return Object.keys(cam.capabilities).some(capabilityName => {
            const service = cam.capabilities[capabilityName];
            return (
                service?.XAddr &&
                capabilityName.toLowerCase().includes(serviceName.toLowerCase())
            );
        });
    }

    return false;
};
