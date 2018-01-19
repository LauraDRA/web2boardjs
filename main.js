const ELECTRON = require('electron'),
    LOG = require('electron-log'),
    FS = require('fs'),
    HTTPS = require('https'),
    PATH = require('path'),
    APP = ELECTRON.app;

const UNPACKED_PATH = (__dirname.indexOf('app.asar') !== -1) ? __dirname.replace('app.asar', 'app.asar.unpacked') : __dirname,
    ARDUINO_IDE_PLATFORM_PREFIX = {
        darwin: PATH.join('Arduino.app/Contents/Java/'),
        win32: PATH.join('arduino-1.8.5/'),
        linux: ''
    };

const PATHS = {
    arduinoBuilder: PATH.join(UNPACKED_PATH, '/res/arduino_ide/', process.platform, ARDUINO_IDE_PLATFORM_PREFIX[process.platform], 'arduino-builder'),
    hardware: PATH.join(UNPACKED_PATH, '/res/arduino_ide/', process.platform, ARDUINO_IDE_PLATFORM_PREFIX[process.platform], 'hardware'),
    tools: PATH.join(UNPACKED_PATH, '/res/arduino_ide/', process.platform, ARDUINO_IDE_PLATFORM_PREFIX[process.platform], 'hardware/tools'),
    toolsBuilder: PATH.join(UNPACKED_PATH, '/res/arduino_ide/', process.platform, ARDUINO_IDE_PLATFORM_PREFIX[process.platform], 'tools-builder'),
    builtInLibraries: PATH.join(UNPACKED_PATH, '/res/arduino_ide/', process.platform, ARDUINO_IDE_PLATFORM_PREFIX[process.platform], 'libraries'),
    arduinoLibraries: PATH.join(UNPACKED_PATH, '/res/arduino_libs'),
    tempInoFile: '/main.ino',
    compilationFolder: '/compilation'
};


const DRIVERS = {
    darwin: [
        {
            filePath: PATH.join(UNPACKED_PATH, '/res/drivers/darwin/FTDIUSBSerialDriver_v2_4_2.dmg'),
            description: 'Drivers FTDI ZUM'

        },
        {
            filePath: PATH.join(UNPACKED_PATH, '/res/drivers/darwin/Mac_OSX_VCP_Driver/SiLabsUSBDriverDisk.dmg'),
            description: 'Drivers VCP Zowi'
        }
    ],
    win32: [
        {
            filePath: PATH.join(UNPACKED_PATH, '/res/drivers/win32/CDM21228_Setup.exe'),
            description: 'Drivers BQ Zum Core'
        },
        {
            filePath: PATH.join(UNPACKED_PATH, '/res/drivers/win32/CP210x_Windows_Drivers/CP210xVCPInstaller_' + process.arch + '.exe'),
            description: 'Drivers VCP Zowi'
        },
        {
            filePath: PATH.join(UNPACKED_PATH, '/res/drivers/win32/drivers/dpinst-' + process.arch + '.exe'),
            description: 'Drivers Arduino'
        }
    ]
};


const compiler = require('./libs/compiler.js')(PATHS);
const uploader = require('./libs/uploader.js')(PATHS);
const serial = require('./libs/serial.js')();
const arduinolibs = require('./libs/arduinolibs.js')(PATHS, UNPACKED_PATH);



LOG.info('Paths', __dirname, UNPACKED_PATH);
LOG.info('Starting in platform: ' + process.platform);


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
            /*data.board = {
                mcu: 'pro-mini'
            };*/
            //data.code = 'void setup() { pinMode(3, OUTPUT);}void loop() {digitalWrite(3, HIGH);delay(1000);digitalWrite(3, LOW);delay(1000);}';
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

        socket.on('update_arduino_libs', function (data, callback) {
            LOG.info('update_arduino_libs', data);
            arduinolibs.update(data, function (err, result) {
                formatResponse(err, result, 'update_arduino_libs', callback);
            });
        });
    });
}

function formatResponse(err, result, info, callback) {
    let response;
    if (err) {
        let message = '';
        if (err.message) {
            message = err.message;
        }
        LOG.info('error', info, err);
        response = {
            status: -1,
            error: err,
            message: message
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
    //testingFunctionOnLoad();

});

function testingFunctionOnLoad() {
    var blinkProgram = 'void setup(){pinMode(3, OUTPUT);}  void loop(){ digitalWrite(3, HIGH); delay(1000); digitalWrite(3, LOW); delay(1000); }';
    var emptyProgram = 'void setup(){}  void loop(){  }';
    var data = {
        board: { mcu: 'uno' },
        code: blinkProgram
    };
    uploader.load(data, function (err, result) {
        LOG.info(err, result);
    });
};

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
