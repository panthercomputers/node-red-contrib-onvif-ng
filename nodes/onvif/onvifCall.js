<!--
  Original work:
  Copyright 2018 Bart Butenaers

  Modifications:
  Copyright 2025 Panther Computers

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0
-->
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

    if (service && !deviceConfig.cam.services?.[service]) {
        node.error(`ONVIF service not supported: ${service}`, msg);
        return;
    }

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

        cam[method](params, (err, result, xml) => {
            if (completed) return;
            completed = true;
            clearTimeout(timeoutHandle);

            if (err) {
                node.error(err.message || err, msg);
                return;
            }

            if (onSuccess) {
                onSuccess(result, xml);
            } else {
                msg.payload = result;
                node.send(msg);
            }
        });
    }
    catch (err) {
        clearTimeout(timeoutHandle);
        node.error(`ONVIF exception (${method}): ${err.message}`, msg);
    }
};
