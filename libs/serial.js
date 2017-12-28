module.exports = function () {
    const LOG = require('electron-log'),
        SERIAL_PORT = require('serialport'),
        READ_LINE = SERIAL_PORT.parsers.Readline,
        DEFAULT_DELIMITER = '\r\n';

    var port,
        parser;

    function openSerialPort(params, socket, callback) {
        if (params && params.port && params.baudRate) {
            if (!port) {
                port = new SERIAL_PORT(params.port, { baudRate: params.baudRate }, function (err) {
                    if (err) {
                        LOG.info('error openening port', err);
                        callback(err.message);
                        closeSerialPort();
                    } else {
                        callback(null, 'port-opened')
                        parser = port.pipe(new READ_LINE({ delimiter: params.delimiter || DEFAULT_DELIMITER }));
                        parser.on('data', function (data) {
                            socket.emit('serialportdata', data);
                        });
                        callback(null, 'port-opened');
                    }
                });
                port.on('error', function (err) {
                    LOG.info('error', err);
                    closeSerialPort();
                });
                port.on('close', function (err) {
                    LOG.info('close', err);
                    socket.emit('serialportclosed');
                    closeSerialPort();
                });
            } else {
                callback(null, 'port-was-opened-before')
            }
        } else if (!params) {
            callback('no-params');
        } else if (!params.port) {
            callback('no-port');
        } else {
            callback('no-baudrate');
        }
    }

    function closeSerialPort(callback) {
        if (port) {
            if (port.isOpen) {
                port.close(function (err) {
                    LOG.info('Port closed', err);
                    port = null;
                    if (callback) {
                        callback(err);
                    }
                });
            } else {
                port = null;
                if (callback) {
                    callback();
                }
            }
        } else {
            if (callback) {
                callback();
            }
        }
    }

    function sendToSerialPort(params, callback) {
        if (port) {
            port.write(params.data, callback);
        } else {
            callback('port-not-opened');
        }
    }

    function getPorts(callback) {
        SERIAL_PORT.list(function (err, ports) {
            callback(err, ports);
        });
    }

    return {
        openSerialPort: openSerialPort,
        closeSerialPort: closeSerialPort,
        getPorts: getPorts
    };
};