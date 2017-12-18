module.exports = function (PATHS) {
    const ASYNC = require('async'),
        LOG = require('electron-log'),
        CHILD = require('child_process'),
        FS = require('fs'),
        UUIDV4 = require('uuid/v4'),
        RIMRAF = require('rimraf'),
        MKDIRP = require('mkdirp'),
        PATH = require('path'),
        OS = require('os');

    function compile(data, callback) {
        LOG.info('compile', data);
        data = JSON.parse(data);
        ASYNC.parallel([
            ASYNC.apply(formatBoardInfo, data),
            ASYNC.apply(getPort, data),
            ASYNC.apply(createTempFiles, data)
        ], function (err, results) {
            if (err) {
                LOG.info('error in the compile process', err);
                callback(JSON.stringify({
                    status: -1,
                    error: err
                }));
            } else {
                let boardFqbn = results[0],
                    port = results[1],
                    tmpPath = results[2],
                    compilationFolderPath = tmpPath + PATHS.compilationFolder,
                    pathToIno = tmpPath + PATHS.tempInoFile;

                let command = [
                    PATHS.arduinoBuilder,
                    '-compile',
                    '-hardware',
                    PATHS.hardware,
                    '-tools',
                    PATHS.tools,
                    '-tools',
                    PATHS.toolsBuilder,
                    '-fqbn',
                    boardFqbn,
                    '-built-in-libraries',
                    PATHS.builtInLibraries,
                    '-libraries',
                    PATHS.arduinoLibraries,
                    '-ide-version',
                    '10609',
                    '-build-path',
                    '"' + compilationFolderPath + '"',
                    '-debug-level',
                    '10',
                    '"' + pathToIno + '"'
                ].join(' ');
                callArduinoIde(command, function (err, output) {
                    LOG.info('result callArduinIde');
                    LOG.info(err, output);
                    if (err) {
                        callback(JSON.stringify({
                            status: -1,
                            error: err,
                            output: output
                        }));
                    } else {
                        callback(JSON.stringify({
                            status: 0,
                            output: output
                        }));
                    }
                    RIMRAF(tmpPath, function (error) {
                        LOG.info('temp path deleted');
                    });
                });
            }
        });
    }


    function formatBoardInfo(data, callback) {
        LOG.info('formatBoardInfo');
        switch (data.board) {
            case 'bt328':
                boardInfo = 'arduino:avr:bt:cpu=atmega328';
                break;
            default:

        }
        if (boardInfo) {
            callback(null, boardInfo);
        } else {
            callback('cant format board info');
        }
    }

    function getPort(data, callback) {
        LOG.info('getPort');
        if (data.port) {
            callback(null, data.port);
        } else {
            getPortByBoard(data, callback);
        }
    }

    function getPortByBoard(data, callback) {
        LOG.info('getPortByBoard');
        //TODO:
        callback(null, '/dev/cu.usbserial-A402PJHM');
    }

    function createTempFiles(data, callback) {
        LOG.info('createTempInoFile');
        let tmpPath = PATH.join(OS.homedir(), '.web2boardjs', 'tmp', UUIDV4());
        MKDIRP.sync(tmpPath);

        ASYNC.parallel([
            ASYNC.apply(MKDIRP, tmpPath + PATHS.compilationFolder),
            ASYNC.apply(createTempInoFile, data, tmpPath),
        ], function (err, results) {
            callback(err, tmpPath);
        });
    }
    function createTempInoFile(data, tmpPath, callback) {
        FS.writeFile(tmpPath + PATHS.tempInoFile, data.code, function (err) {
            callback(err, tmpPath + PATHS.tempInoFile);
        });
    }

    function callArduinoIde(command, callback) {
        LOG.info('callArduinoIde', command);
        CHILD.exec(command, function (err, stdout, stderr) {
            LOG.info('err', err);
            LOG.info('stderr', stderr);
            LOG.info('stdout', stdout);
            callback(err, {
                stderr: stderr,
                stdout: stdout
            });
        });
    }

    return {
        compile: compile
    };
};
