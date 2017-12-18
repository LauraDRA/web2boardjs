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

                var child = CHILD.fork('libs/uploadchild.js');

                child.on('message', function (message) {

                    switch (message.type) {
                        case 'compilationDone':
                            LOG.info('compilation OK');
                            callback(null, message);
                            child.kill();
                            break;
                        case 'info':
                            LOG.info('Message from child: ', message.info);
                            break;
                        case 'error':
                            LOG.error('Error from child: ', message);//TODO port blocked error
                            callback({
                                status: -1,
                                error: message.error
                            });
                            child.kill();
                            break;
                        default:
                            LOG.info('Not defined Message from child: ', message);
                    }

                });
                child.on('close', function (m, signal) {
                    console.log('PARENT got close:', m, signal);
                });
                child.on('disconnect', function (m, signal) {
                    console.log('PARENT got disconnect:', m, signal);
                });
                child.on('error', function (m, signal) {
                    console.log('PARENT got error:', m, signal);
                });
                child.on('exit', function (m, signal) {
                    console.log('PARENT got exit:', m, signal);
                });


                child.send({
                    hex: result[0],
                    board: result[1],
                    port: params.port
                });


                /*let AVRGIRL = require('avrgirl-arduino'),
                    hex = result[0],
                    board = result[1],
                    avrgirl = new AVRGIRL({
                        board: board,
                        debug: true,
                        port: params.port
                    });
                hex = new Buffer(hex);
                avrgirl.flash(hex, function (error) {
                    if (error) {
                        callback({
                            status: -1,
                            error: error
                        });
                    } else {
                        callback({
                            status: 0
                        });
                    }
                });*/
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
        switch (params.board) {
            case 'bt328':
                result = 'bqZum';
                break;
            default:
                result = params.board;
        }
        callback(null, result);
    }

    return {
        load: load
    };
};