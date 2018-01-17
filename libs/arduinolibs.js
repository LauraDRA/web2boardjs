module.exports = function (PATHS, UNPACKED_PATH) {

    const ASYNC = require('async'),
        LOG = require('electron-log'),
        FS = require('fs');

    function getArduinoLibsCurrentVersion(callback) {
        FS.readFile(PATHS.arduinoLibraries + '/version.json', 'utf8', function (err, res) {
            if (err) {
                callback(err);
            } else {
                callback(null, res);
            }
        });
    }

    function downloadBitbloqLibsVersion(version, callback) {
        http.get({
            hostname: 'github.com',
            port: 80,
            path: '/bq/bitbloqLibs/archive/' + newVersion + '.zip',
        }, function (err, res) {
            LOG.info(err, res);
        });
    }

    function update(data, callback) {
        getArduinoLibsCurrentVersion(function (err, currentVersion) {
            if (err) {
                callback(err);
            } else {
                if (data.version !== currentVersion) {
                    ASYNC.waterfall([
                        ASYNC.apply(downloadBitbloqLibsVersion, data),
                        ASYNC.apply()
                    ], function () {

                    });
                } else {
                    callback();
                }
            }
        });


        //descargar nueva version en tmp
        // borrar anterior version
        //descomprimir en la carpeta
        //actualizar fichero de version
    }



    return {
        update: update
    };
};