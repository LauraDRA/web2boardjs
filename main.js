const ELECTRON = require('electron'),
    LOG = require('electron-log'),
    FS = require('fs'),
    HTTPS = require('https'),
    APP = ELECTRON.app;

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


const compiler = require('./libs/compiler.js')(PATHS);
const uploader = require('./libs/uploader.js')(PATHS);
const serial = require('./libs/serial.js')();



LOG.info('starting in platform: ' + process.platform);


let io, httpsServer;

function startSocketServer() {
    if (httpsServer) {
        httpsServer.close();
    }
    if (io) {
        io.close();
    }

    io = require('socket.io')(9876);

    io.on('connection', function (socket) {
        socket.on('message', function (data) {
            LOG.info('message', data);
        });
        socket.on('compile', function (data, callback) {
            LOG.info('compile', data);
            compiler.compile(data, function (err, result) {
                formatResponse(err, result, 'compile', callback);
            });
        });
        socket.on('upload', function (data, callback) {
            LOG.info('upload', data);
            uploader.load(data, function (err, result) {
                formatResponse(err, result, 'upload', callback);
            });
        });

        socket.on('openserialport', function (data, callback) {
            LOG.info('openserialport', data);
            serial.openSerialPort(data, socket, function (err, result) {
                formatResponse(err, result, 'openserialport', callback);
            });
        });

        socket.on('closeserialport', function (data, callback) {
            LOG.info('closeserialport');
            serial.closeSerialPort(function (err, result) {
                formatResponse(err, result, 'closeSerialPort', callback);
            });
        });

        socket.on('sendtoserialport', function (data, callback) {
            LOG.info('sendtoserialport', data);
            serial.sendToSerialPort(data, function (err) {
                formatResponse(err, null, 'sendToSerialPort', callback);
            });
        });

        socket.on('getports', function (data, callback) {
            LOG.info('getports');
            serial.getPorts(function (err, result) {
                formatResponse(err, result, 'getPorts', callback);
            });
        });

        socket.on('disconnect', function (data) {
            LOG.info('disconnect', data);
            serial.closeSerialPort();
        });

        socket.on('version', function (data, callback) {
            LOG.info('version', APP.getVersion());
            callback({
                status: 0,
                version: APP.getVersion()
            });
        });
    });
}

function formatResponse(err, result, info, callback) {
    let response;
    if (err) {
        LOG.info('error', info, err);
        response = {
            status: -1,
            error: err
        };
    } else {
        response = {
            status: 0,
            data: result
        };
    }
    callback(response);
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
