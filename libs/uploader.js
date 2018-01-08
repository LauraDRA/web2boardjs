module.exports = function (PATHS) {
    const LOG = require('electron-log'),
        ASYNC = require('async'),
        CHILD = require('child_process'),
        COMPILER = require('./compiler.js')(PATHS);

    function load(params, callback) {
        ASYNC.parallel([
            ASYNC.apply(getHex, params),
            ASYNC.apply(getBoardId, params)
        ], function (err, result) {
            if (err) {
                LOG.info('err on compile', err);
                callback(err);
            } else {
                LOG.info('start loading');

                let child = CHILD.fork('libs/uploadchild.js', {
                    silent: false,
                    stdio: [0, 1, 2, 'ipc']
                });
                let compilationComplete = false;

                child.on('message', function (message) {

                    switch (message.type) {
                        case 'compilationDone':
                            LOG.info('compilation OK');
                            callback(null, message);
                            compilationComplete = true;
                            child.kill();
                            break;
                        case 'info':
                            LOG.info('Message from child: ', message.info);
                            break;
                        case 'error':
                            LOG.error('Error from child: ', message);
                            callback({
                                status: -1,
                                error: message.error
                            });
                            compilationComplete = true;
                            child.kill();
                            break;
                        default:
                            LOG.info('Not defined Message from child: ', message);
                    }

                });
                child.on('close', function (m, signal) {
                    if (!compilationComplete) {
                        callback('Parent got close: ' + m + signal);
                        compilationComplete = true;
                    }
                });
                child.on('disconnect', function () {
                    if (!compilationComplete) {
                        callback('Parent got Disconnect');
                        compilationComplete = true;
                    }
                });
                child.on('error', function (m, signal) {
                    if (!compilationComplete) {
                        callback('Parent got Error:' + m + signal);
                        compilationComplete = true;
                    }
                });
                child.on('exit', function (m, signal) {
                    if (!compilationComplete) {
                        callback('Parent got signal:' + m + signal);
                        compilationComplete = true;
                    }
                });

                child.send({
                    hex: result[0],
                    board: result[1],
                    port: params.port
                });
            }
        });
    }

    function getHex(params, callback) {
        if (params.hex) {
            callback(null, params.hex);
        } else {
            COMPILER.compile(params, callback);
        }
    }

    function getBoardId(params, callback) {
        let result;
        if (params && params.board) {
            LOG.info('params here');
            LOG.info(params);
            switch (params.board.mcu) {
                case 'bt328':
                    result = 'bqZum';
                    break;
                case 'bt328':
                    result = 'bqZum';
                    break;
                default:
                    result = params.board;
            }
        }

        callback(null, result);
    }

    return {
        load: load
    };
};