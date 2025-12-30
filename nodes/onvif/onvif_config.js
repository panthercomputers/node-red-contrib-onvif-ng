'use strict';

module.exports = function (RED) {
    const onvif = require('onvif');

    const STATUS = {
        CONNECTED: 'connected',
        DISCONNECTED: 'disconnected',
        INITIALIZING: 'initializing',
        UNCONFIGURED: 'unconfigured'
    };

    function setStatus(node, status) {
        node.onvifStatus = status;
        node.emit('onvif_status', status);
    }

    function OnvifConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.name = config.name;
        node.xaddress = config.xaddress;
        node.port = Number(config.port || 80);
        node.timeout = Number(config.timeout || 3);
        node.checkConnectionInterval = Number(config.checkConnectionInterval || 5);

        node.cam = null;
        node.onvifStatus = STATUS.UNCONFIGURED;
        node._initializing = false;
        node._checking = false;
        node._timer = null;

        node.setMaxListeners(50);

        /* --------------------------------------------------
         * Initialize camera connection
         * -------------------------------------------------- */
        node.initialize = function () {
            if (node.cam || node._initializing) return;

            if (!node.xaddress) {
                setStatus(node, STATUS.UNCONFIGURED);
                return;
            }

            node._initializing = true;
            setStatus(node, STATUS.INITIALIZING);

            const options = {
                hostname: node.xaddress,
                port: node.port,
                timeout: node.timeout * 1000
            };

            if (node.credentials?.user) {
                options.username = node.credentials.user;
                options.password = node.credentials.password;
            }

            node.cam = new onvif.Cam(options, function (err) {
                node._initializing = false;

                if (err) {
                    node.error(err);
                    node.cam = null;
                    setStatus(node, STATUS.DISCONNECTED);
                    return;
                }

                setStatus(node, STATUS.CONNECTED);
            });

            if (node.checkConnectionInterval > 0) {
                node._timer = setInterval(() => {
                    if (!node.cam || node._checking) return;

                    node._checking = true;
                    node.cam.getSystemDateAndTime((err) => {
                        node._checking = false;

                        if (err) {
                            setStatus(node, STATUS.DISCONNECTED);
                        } else {
                            setStatus(node, STATUS.CONNECTED);
                        }
                    });
                }, node.checkConnectionInterval * 1000);
            }
        };

        /* --------------------------------------------------
         * Profiles helper (editor UI)
         * -------------------------------------------------- */
        node.getProfiles = function (clientConfig, res) {
            const creds = node.credentials || {};

            const cfg = {
                hostname: clientConfig.hostname || node.xaddress,
                port: clientConfig.port || node.port,
                username: clientConfig.user || creds.user,
                password: clientConfig.password || creds.password,
                timeout: node.timeout * 1000
            };

            if (cfg.password && creds.password) {
                cfg.password = cfg.password.replace('___PWRD__', creds.password);
            }

            new onvif.Cam(cfg, function (err) {
                if (err || !this.profiles) {
                    res.json([]);
                    return;
                }

                res.json(
                    this.profiles.map(p => ({
                        label: p.name,
                        value: p.$.token
                    }))
                );
            });
        };

        /* --------------------------------------------------
         * Startup / shutdown
         * -------------------------------------------------- */
        node.initialize();

        node.on('close', function () {
            if (node._timer) {
                clearInterval(node._timer);
                node._timer = null;
            }
            node.cam = null;
            setStatus(node, '');
        });
    }

    RED.nodes.registerType('onvif-config', OnvifConfigNode, {
        credentials: {
            user: { type: 'text' },
            password: { type: 'password' }
        }
    });

    /* --------------------------------------------------
     * Editor HTTP endpoint
     * -------------------------------------------------- */
    RED.httpAdmin.get(
        '/onvifdevice/:cmd/:id',
        RED.auth.needsPermission('onvifdevice.read'),
        function (req, res) {
            const node = RED.nodes.getNode(req.params.id);
            if (!node) {
                res.status(404).json([]);
                return;
            }

            if (req.params.cmd === 'profiles') {
                node.getProfiles(req.query, res);
            } else {
                res.status(400).json([]);
            }
        }
    );
};
