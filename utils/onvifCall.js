/**
 * Shared ONVIF call wrapper
 * Panther Computers – 2025
 */

const DEFAULT_TIMEOUT = 7000;
const DEFAULT_RETRIES = 1;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Safe ONVIF method invocation
 *
 * @param {object} options
 * @param {object} options.node        Node-RED node
 * @param {object} options.cam         ONVIF camera instance
 * @param {string} options.method      Method name (string)
 * @param {object|undefined} options.args  Method arguments
 * @param {number} options.timeout     Timeout in ms
 * @param {number} options.retries     Retry count
 *
 * @returns {Promise<{data:any, xml:any}>}
 */
async function onvifCall({
    node,
    cam,
    method,
    args = undefined,
    timeout = DEFAULT_TIMEOUT,
    retries = DEFAULT_RETRIES
}) {
    if (!cam || typeof cam[method] !== "function") {
        throw new Error(`ONVIF method not available: ${method}`);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const result = await new Promise((resolve, reject) => {
                let finished = false;

                const timer = setTimeout(() => {
                    if (!finished) {
                        finished = true;
                        reject(new Error(`ONVIF timeout: ${method}`));
                    }
                }, timeout);

                const callback = (err, data, xml) => {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timer);

                    if (err) {
                        reject(err);
                    } else {
                        resolve({ data, xml });
                    }
                };

                try {
                    if (args !== undefined) {
                        cam[method](args, callback);
                    } else {
                        cam[method](callback);
                    }
                }
                catch (err) {
                    clearTimeout(timer);
                    reject(err);
                }
            });

            return result;
        }
        catch (err) {
            if (attempt >= retries) {
                throw err;
            }
            await sleep(300);
        }
    }
}

module.exports = {
    onvifCall
};
