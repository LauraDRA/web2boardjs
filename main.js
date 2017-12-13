const electron = require('electron');
const async = require("async");
const path = require('path');
const os = require('os');
const uuidV4 = require('uuid/v4');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const log = require('electron-log');


const app = electron.app;

let io;

function startSocketServer() {
    if (io) {
        io.close();
    }
    io = require('socket.io')(9876);

    io.on('connection', function (socket) {
        socket.on('message', function (data) {
            console.log('message', data);
        });
        socket.on('compile', compile);
        socket.on('disconnect', function (data) {
            console.log('disconnect', data);
        });
    });
}

function compile(data, callback) {
    log.info('compile', data);
    data = JSON.parse(data);
    data.tempPath = path.join(os.homedir(), '.web2boardjs', 'tmp', uuidV4());
    mkdirp(data.tempPath);
    async.parallel([
        async.apply(formatBoardInfo, data),
        async.apply(getPort, data),
        async.apply(createTempInoFile, data)
    ], function (err, results) {
        if (err) {
            callback(JSON.stringify({
                status: -1,
                error: err
            }));
        } else {
            //  arduino:avr:nano:cpu=atmega168
            //  /dev/ttyACM0
            //  /path/to/sketch/sketch.ino

            //arduino_ide/mac/Arduino.app/Contents/MacOS/Arduino --verify --board arduino:avr:bt:cpu=atmega328 --port /dev/cu.usbserial-A402PJHM test/res/off.ino
            //arduino_ide/mac/Arduino.app/Contents/Java/arduino-builder --compile -hardware="arduino_ide/mac/Arduino.app/Contents/Java/hardware" -tools="arduino_ide/mac/Arduino.app/Contents/Java/hardware/tools" -tools="arduino_ide/mac/Arduino.app/Contents/Java/tools-builder" -fqbn="arduino:avr:bt:cpu=atmega328" test/res/blink.ino
            //arduino_ide/mac/Arduino.app/Contents/Java/arduino-builder --compile -hardware="arduino_ide/mac/Arduino.app/Contents/Java/hardware" -tools="arduino_ide/mac/Arduino.app/Contents/Java/hardware/tools" -tools="arduino_ide/mac/Arduino.app/Contents/Java/tools-builder" -built-in-libraries="arduino_ide/mac/Arduino.app/Contents/Java/libraries" -fqbn="arduino:avr:bt:cpu=atmega328" -build-path="/Users/tom/temp/build/" "test/res/off.ino"
            //arduino_ide/mac/Arduino.app/Contents/Java/arduino-builder -compile -hardware="arduino_ide/mac/Arduino.app/Contents/Java/hardware" -tools="arduino_ide/mac/Arduino.app/Contents/Java/hardware/tools" -tools="arduino_ide/mac/Arduino.app/Contents/Java/tools-builder" -fqbn="arduino:avr:bt:cpu=atmega328" -built-in-libraries="arduino_ide/mac/Arduino.app/Contents/Java/libraries" -ide-version="10609" -build-path="/Users/tom/.avrpizza/tmp/dfde8910-dfd9-11e7-a185-9172707aa7ba" -debug-level="10" /Users/tom/web2boardjs/test/res/off/off.ino
            //res/arduino_ide/mac/Arduino.app/Contents/Java/arduino-builder -compile -hardware="res/arduino_ide/mac/Arduino.app/Contents/Java/hardware" -tools="res/arduino_ide/mac/Arduino.app/Contents/Java/hardware/tools" -tools="res/arduino_ide/mac/Arduino.app/Contents/Java/tools-builder" -fqbn="arduino:avr:bt:cpu=atmega328" -built-in-libraries="res/arduino_ide/mac/Arduino.app/Contents/Java/libraries" -libraries="res/arduino_libs" -ide-version="10609" -build-path="/Users/tom/.avrpizza/tmp/dfde8910-dfd9-11e7-a185-9172707aa7ba" -debug-level="10" /Users/tom/web2boardjs/test/res/off/off.ino
            callArduinoIde('arduino --board ' + results[0] + ' --port ' + results[1] + ' --upload ' + results[2], function (err) {
                if (err) {
                    callback(JSON.stringify({
                        status: -1,
                        error: err
                    }));
                } else {
                    callback(JSON.stringify({
                        status: 0
                    }));
                }
                rimraf(paths.dest, function (error) {
                    console.log();
                });
            });
        }
    });
}


function formatBoardInfo(data, callback) {
    log.info('formatBoardInfo');
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
    log.info('getPort');
    if (data.port) {
        callback(null, data.port);
    } else {
        getPortByBoard(data, callback);
    }
}

function getPortByBoard(data, callback) {
    log.info('getPortByBoard');
    //TODO:
    callback(null, '/dev/cu.usbserial-A402PJHM');
}

function createTempInoFile(data, callback) {
    log.info('createTempInoFile');
    data.tempPath //HERE
}

function callArduinoIde(command, callback) {

}



app.on('start', function () {
    console.log('start');
});
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', function () {
    console.log('ready');
    startSocketServer();
});

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    console.log('window-all-closed');
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    console.log('activate');

});

let tryTimeout;
process.on('uncaughtException', function (error) {
    // Handle the error
    console.log('uncaughtException', error);
    if (tryTimeout) {
        clearTimeout(tryTimeout);
    }
    tryTimeout = setTimeout(startSocketServer, 3000);
});
