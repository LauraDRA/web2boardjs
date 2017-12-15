const ELECTRON = require('electron');
const ASYNC = require('async');
const PATH = require('path');
const OS = require('os');
const UUIDV4 = require('uuid/v4');
const RIMRAF = require('rimraf');
const MKDIRP = require('mkdirp');
const LOG = require('electron-log');
const FS = require('fs');
const CHILD = require('child_process');
const PATHS = {
    arduinoBuilder: 'res/arduino_ide/' + process.platform + '/Arduino.app/Contents/Java/arduino-builder',
    hardware: 'res/arduino_ide/' + process.platform + '/Arduino.app/Contents/Java/hardware',
    tools: 'res/arduino_ide/' + process.platform + '/Arduino.app/Contents/Java/hardware/tools',
    toolsBuilder: 'res/arduino_ide/' + process.platform + '/Arduino.app/Contents/Java/tools-builder',
    builtInLibraries: 'res/arduino_ide/' + process.platform + '/Arduino.app/Contents/Java/libraries',
    arduinoLibraries: 'res/arduino_libs',
    tempInoFile: '/main.ino',
    compilationFolder: '/compilation'
};
const APP = ELECTRON.app;

LOG.info('starting in platform: ' + process.platform);


let io;

function startSocketServer() {
    if (io) {
        io.close();
    }
    io = require('socket.io')(9876);

    io.on('connection', function (socket) {
        socket.on('message', function (data) {
            LOG.info('message', data);
        });
        socket.on('compile', compile);
        socket.on('disconnect', function (data) {
            LOG.info('disconnect', data);
        });
    });
}

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



APP.on('start', function () {
    LOG.info('start');
});
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
APP.on('ready', function () {
    LOG.info('ready');
    startSocketServer();
});

// Quit when all windows are closed.
APP.on('window-all-closed', function () {
    LOG.info('window-all-closed');
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        APP.quit();
    }
});

APP.on('activate', function () {
    LOG.info('activate');

});

let tryTimeout;
process.on('uncaughtException', function (error) {
    // Handle the error
    LOG.info('uncaughtException', error);
    if (tryTimeout) {
        clearTimeout(tryTimeout);
    }
    tryTimeout = setTimeout(startSocketServer, 3000);
});
