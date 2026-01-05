/**
 * Original work:
 * Copyright 2018 Bart Butenaers
 *
 * Modifications:
 * Copyright 2025 Panther Computers
 *
 * Licensed under the Apache License, Version 2.0
 */

/**
 * NOTE:
 * Device service methods use signature: method(callback)
 * All other services use: method(params, callback)
 */


'use strict';

module.exports = async function onvifCall(node, options) {
    const {
        service,
        method,
        params = {},
        msg,
        allowDisconnected = false,
        timeout = 8000,
        onSuccess
    } = options;

    const deviceConfig = node.deviceConfig;

    if (!deviceConfig || !deviceConfig.cam) {
        node.error('No device configuration available', msg);
        return;
    }

    if (!allowDisconnected && deviceConfig.onvifStatus !== 'connected') {
        node.error('Device not connected', msg);
        return;
    }

// Service presence is determined by method existence (onvif lib behavior)

    const cam = deviceConfig.cam;

    if (typeof cam[method] !== 'function') {
        node.error(`ONVIF method not found: ${method}`, msg);
        return;
    }

    let timeoutHandle;
    let completed = false;

    try {
        timeoutHandle = setTimeout(() => {
            if (!completed) {
                completed = true;
                node.error(`ONVIF call timeout: ${method}`, msg);
            }
        }, timeout);

    const callback = (err, result, xml) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeoutHandle);

        if (err) {
            node.error(err.message || err, msg);
            return;
        }
    
    try {
        if (onSuccess) {
            const sent = onSuccess(result, xml);
            if (sent === false) {
                return;
            }
        } else {
            msg.payload = result;
            node.send(msg);
    }
    } catch (err) {
        node.error(`ONVIF onSuccess error: ${err.message}`, msg);
    }
    };

    // Device service methods do NOT accept params
    if (service === "device") {
        cam[method](callback);
    } else {
        cam[method](params, callback);
    }
    }
    catch (err) {
        clearTimeout(timeoutHandle);
        node.error(`ONVIF exception (${method}): ${err.message}`, msg);
    }
};
