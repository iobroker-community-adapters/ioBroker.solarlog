/**
 * solarlog adapter
 */

/* jshint -W097 */ // jshint strict:false
/*jslint node: true */
'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils

let adapter;

var DeviceIpAdress;
var Port;
var https = require('http');
var schedule = require('node-schedule');
var request = require('request');

const cmd = "/getjp"; // Kommandos in der URL nach der Host-Adresse
var statusuz = "on";
var devicelist = [];
var brandlist = [];
var deviceclasslist = ["Wechselrichter", "Sensor", "Zähler", "Hybrid-System", "Batterie", "Intelligente Verbraucher", "Schalter", "Wärmepumpe", "Heizstab", "Ladestation"];
var numinv = 0;
var names = [];

var deviceinfos = [];
var devicetypes = [];
var devicebrands = [];
var deviceclasses = [];

var json = [];
var lastdaysumy = 99;
var lastdayratioy = 99;

var uzimp;
var battdevicepresent = "false";
var battpresent = "false";
var battindex = [];
var battarrind = 0;
var battdata = [];
var testend;
var testj = 0;
var testi = 0;

var forecast = "false";
var urlforecast = "https://api.forecast.solar/";
var cmdforecast;
var lat;
var lon;
var dec;
var az;
var kwp;

let polling;

function startAdapter(options) {
  options = options || {};
  Object.assign(options, {
    name: 'solarlog'
  });

  adapter = new utils.Adapter(options);

  // when adapter shuts down
  adapter.on('unload', function(callback) {
    try {
      clearInterval(polling);
      adapter.setState('info.connection', false, true);
      adapter.log && adapter.log.info('[END] Stopping solarlog adapter...');
      callback();
    } catch (e) {
      adapter.log && adapter.log.warn("[END 7 catch] adapter stopped ")
      callback();
    }
  });

  // is called if a subscribed object changes
  adapter.on('objectChange', function(id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
  });

  // is called if a subscribed state changes
  adapter.on('stateChange', function(id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
      adapter.log.info('ack is not set!');
    }
  });

  // Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
  adapter.on('message', function(obj) {
    if (typeof obj === 'object' && obj.message) {
      if (obj.command === 'send') {
        // e.g. send email or pushover or whatever
        adapter.log('send command');

        // Send response in callback if required
        if (obj.callback) adapter.sendTo(obj.from, obj.command, 'Message received', obj.callback);
      }
    }
  });

  // is called when databases are connected and adapter received configuration.
  adapter.on('ready', function() {
    if (adapter.config.host) {
      adapter.log.info('[START] Starting solarlog adapter');
      adapter.setState('info.connection', true, true);
      main();
    } else adapter.log.warn('[START] No IP-address set');
  });

  return adapter;
} // endStartAdapter

function main() {
  // Vars
  DeviceIpAdress = adapter.config.host;
  Port = adapter.config.port;
  const cmd = "/getjp"; // Kommandos in der URL nach der Host-Adresse
  var statusuz = "on";
  numinv = 0;
  uzimp = (adapter.config.invimp).toString();
  forecast = (adapter.config.forecast).toString();

  adapter.log.debug("InvImp: " + adapter.config.invimp);
  adapter.log.debug("uzimp: " + uzimp);

  const pollingTime = adapter.config.pollInterval || 300000;
  adapter.log.debug('[INFO] Configured polling interval: ' + pollingTime);
  adapter.log.debug('[START] Started Adapter with: ' + adapter.config.host);

  if (uzimp == "true") {
    adapter.log.debug("uzimp: " + uzimp);
    adapter.log.debug("WR Importieren");

    httpsReqDevicelist();

    testend = setInterval(test, 3000); //�berpr�fen ob alle Channels angelegt sind.

    if (!polling) {
      polling = setTimeout(function repeat() { // poll states every [30] seconds
        httpsReqDataStandard(cmd, uzimp);
        setTimeout(repeat, pollingTime);
      }, pollingTime);
    } // endIf

  } else {
    adapter.log.debug("uzimp: " + uzimp);
    adapter.log.debug("WR nicht Importieren");
    if (forecast = "true") {
      setforecastobjects();
    } else {
      httpsReqDataStandard(cmd, uzimp);
    }

    if (!polling) {
      polling = setTimeout(function repeat() { // poll states every [30] seconds

        httpsReqDataStandard(cmd, uzimp);

        setTimeout(repeat, pollingTime);
      }, pollingTime)
    } // endIf
  }

  var jedentag = schedule.scheduleJob('0 2 * * *', function() {
    adapter.log.info('Langzeitwerte abrufen');
    httpsReqSumYearUZ(cmd, names);
  });

  var jedestunde = schedule.scheduleJob('25 * * * *', function() {
    adapter.log.debug('Forecast-Daten werden abgerufen');
    if (forecast == "true") {
      getforecastdata();
    }
  });

  // all states changes inside the adapters namespace are subscribed
  adapter.subscribeStates('*');
} // endMain

function test() {
  adapter.getState("info.numinv", function(err, obj) {
    if (obj) {
      var numbinv = obj.val;
      adapter.log.debug("Inverters to test: " + names);
      adapter.log.debug("numbinv: " + numbinv);
      names.forEach(check);
      adapter.log.debug("Anzahl positiv: " + testi);
      if (testi == numbinv) {
        clearInterval(testend);
        adapter.log.info("Alle WR/Meter gefunden");
        adapter.log.debug("Names: " + names);
        setdeviceinfo(names);
      } else {
        testi = 0;
        adapter.log.warn("Nicht alle WR/Meter gefunden");
        testj++;
        if (testj > 3) {
          adapter.log.warn("Fehler, noch nicht alle Unterz�hler angelegt");
          clearInterval(testend);
        }
      }
    }
  });
} // END test()

function check(uz) {
  adapter.getObject('INV.' + uz, function(err, obj) {
    if (obj) {
      adapter.log.debug("Adapter " + uz + " vorhanden");
      testi++;
    } else {
      adapter.log.warn("Adapter " + uz + " nicht vorhanden");
    }
  });
} // END check()

function httpsReqDevicelist() { //Füllt die Variabe devicelist mit der Geräteliste aus dem solarlog.
  var data = '{"739":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier können die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);
      try {
        devicelist = JSON.parse(body);
        adapter.log.debug("Devicelist: " + devicelist);
      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler devicelist: " + e.message);
      }

      adapter.log.debug("END Request: " + JSON.stringify(data));
      httpsReqBrandlist();

    });
  });
  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR devicelist: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
  req.end();
} //end httpsReqDevicelist

function httpsReqBrandlist() { //Füllt die Variabe devicelist mit der Geräteliste aus dem solarlog.
  var data = '{"744":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier können die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);
      try {
        brandlist = JSON.parse(body);
      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler brandlist: " + e.message);
      }

      adapter.log.debug("END Request: " + JSON.stringify(data));

      httpsReqNumInv(); //Anlegen eines Channels pro Unterz�hler mit den Objekten Wert und Status
    });
  });
  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR brandlist: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
  req.end();
} //end httpsReqBrandlist

function httpsReqNumInv() { //Ermittelt die Anzahl Unterz�hler und l�st das Anlegen der Channels/Objekte aus.
  var data = '{"740":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };
  adapter.log.debug("Options: " + JSON.stringify(options));
  adapter.log.debug("Data: " + JSON.stringify(data));

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier können die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);
      try {
        var dataJ = JSON.parse(body);

        while (statusuz != "Err" && numinv < 100) {
          statusuz = (dataJ[740][numinv.toString()]);
          //if (statusuz != "OFFLINE") {
          //   adapter.log.debug(dataJ[609][numinv.toString()]);
          //}
          numinv++;
        }
      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler NumInv: " + e.message);
      }
      adapter.setState('info.numinv' /*numinv*/ , numinv - 1, true);
      adapter.log.debug("Numer of Inverters/Meters :" + (numinv - 1));
      adapter.log.debug("END Request: " + JSON.stringify(data));

      adapter.setObjectNotExists('INV', {
        type: 'device',
        role: '',
        common: {
          name: "Inverter"
        },
        native: {}
      });

      getuznames(numinv);
    });
  });
  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR ReqNumInv: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
  req.end();
} //end httpsReqNumInv

function getuznames(numinv) { //Schlaufe mit Abfrage der Information pro Unterz�hler und ausl�sen der Objekterstellung
  for (var i = 0; i < (numinv - 1); i++) {
    var data1 = '{"141":{"';
    var data2 = '":{"119":null}}}';
    var datauz = data1 + i.toString() + data2;
    var options = {
      host: DeviceIpAdress,
      port: Port,
      path: cmd,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'applciation/json',
        'Content-Length': datauz.length
      }
    };

    adapter.log.debug("Options: " + JSON.stringify(options));
    adapter.log.debug("Data: " + JSON.stringify(datauz));

    httpsReqGetUzNames(datauz, options, i);
  }
} //end getuznames

function httpsReqGetUzNames(datauz, options, i) { //erstellt die Channels und Objekte pro Unterz�hler
  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var bodyuz = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + bodyuz);

      try {
        var dataJuz = (JSON.parse(bodyuz));
        names.push(dataJuz[141][i.toString()][119]);
        adapter.log.debug("Inverters: " + names);

        if (i == (numinv - 2)) {
          adapter.log.debug("Lese Geräteinformationen");
          getuzdeviceinfo();
        }

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler httpsReqGetUzNames: " + e.message);
      }
    });
  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR httpsReqGetUzNames: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + datauz);
  // write data to request body
  (datauz ? req.write(datauz) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
  req.end();
} //End httpsReqGetUzNames

function getuzdeviceinfo() { //Schlaufe mit Abfrage der Information pro Unterz�hler und ausl�sen der Objekterstellung
  for (var i = 0; i < (numinv - 1); i++) {
    var data1 = '{"141":{"';
    var data2 = '":{"162":null}}}';
    var datauz = data1 + i.toString() + data2;
    var options = {
      host: DeviceIpAdress,
      port: Port,
      path: cmd,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'applciation/json',
        'Content-Length': datauz.length
      }
    };

    adapter.log.debug("Options: " + JSON.stringify(options));
    adapter.log.debug("Data: " + JSON.stringify(datauz));

    httpsReqGetUzDeviceinfo(datauz, options, i);
  }

} //end getuzdeviceinfo

function httpsReqGetUzDeviceinfo(datauz, options, i) { //erstellt die Channels und Objekte pro Unterz�hler
  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var bodyuz = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + bodyuz);

      try {
        var dataJuz = (JSON.parse(bodyuz));

        deviceinfos.push(dataJuz[141][i.toString()][162]);
        adapter.log.debug("Deviceinfos: " + deviceinfos);

        if (i == (numinv - 2)) {
          defdeviceinfo();
        }
      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler httpsReqGetUzDeviceinfo: " + e.message);
      }
    });
  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR httpsReqGetUzDeviceinfo: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + datauz);
  // write data to request body
  (datauz ? req.write(datauz) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
  req.end();
} //End httpsReqGetUzDeviceinfo

function defdeviceinfo() { //Geräteinfos httpsReqGetUzDeviceinfo
  var namLeng = names.length;
  for (var y = 0; y < namLeng; y++) {
    adapter.log.debug("INV." + names[y] + ".devicetype: " + devicelist[739][deviceinfos[y]][1]);
    devicetypes.push(devicelist[739][deviceinfos[y]][1]);

    adapter.log.debug("INV." + names[y] + ".devicebrand: " + brandlist[744][devicelist[739][deviceinfos[y]][0]]);
    devicebrands.push(brandlist[744][devicelist[739][deviceinfos[y]][0]]);

    deviceclasses.push(deviceclasslist[(Math.log(devicelist[739][deviceinfos[y]][5]) / Math.LN2)]);
    if (deviceclasslist[(Math.log(devicelist[739][deviceinfos[y]][5]) / Math.LN2)] == "Batterie") {
      battdevicepresent = "true";
      adapter.log.debug("Batterie als Gerät vorhanden");
      battindex[battarrind] = y;
      adapter.log.debug("Index Gerät Batterie: " + y);
      battarrind++;

      adapter.log.debug("INV." + names[y] + ".deviceclass: " + deviceclasslist[(Math.log(devicelist[739][deviceinfos[y]][5]) / Math.LN2)]);

    }
    adapter.log.debug("Batterie als Gerät: " + battdevicepresent);
  }
  adapter.log.debug("Devicetypes: " + devicetypes);
  adapter.log.debug("Devicebrands: " + devicebrands);
  adapter.log.debug("Deviceclasses: " + deviceclasses);

  httpsReqBattpresent();
} // end defdeviceinfo

function httpsReqBattpresent() { //Abfrage der Batteriewerte um festzustellen, ob eine solche vorhanden ist.
  var data = '{"858":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        battdata = JSON.parse(body)[858];
        adapter.log.debug("Battdata: " + battdata);
        if (battdata.length > 0) {
          battpresent = "true";
          adapter.log.debug("Batterie vorhanden, lege Objekte an.");
          adapter.log.debug("Batteriestatus: " + battpresent);

        } else {
          adapter.log.debug("Keine Batterie vorhanden.");
          adapter.log.debug("Batteriestatus: " + battpresent);
        }

        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler httpsReqBattpresent: " + e.message);
      }
      setInvObjects();

    });
  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR httpsReqBattpresent: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqBattpresent

function setInvObjects() {
  // create Channel Inverter(i)
  adapter.log.debug("Lege nun Objekte an - soweit nicht vorhanden 2");
  adapter.log.debug("NumInv Obj: " + numinv);
  adapter.log.debug("Names zum anlegen: " + names);
  for (var i = 0; i < (numinv - 1); i++) {
    adapter.setObjectNotExists('INV.' + names[i], {
      type: 'channel',
      role: '',
      common: {
        name: "" + names[i]
      },
      native: {}
    });

    // create States PAC/Status/DaySum Inverter(i)
    if (deviceclasses[i] != "Batterie") {
      adapter.setObjectNotExists('INV.' + names[i] + ".PAC", {
        type: 'state',
        common: {
          name: 'PAC',
          desc: 'Power AC',
          type: 'number',
          role: "value.pac",
          read: true,
          write: false,
          unit: "W"
        },
        native: {}
      });
    }

    adapter.setObjectNotExists('INV.' + names[i] + ".status", {
      type: 'state',
      common: {
        name: 'status',
        desc: 'Staus of Inverter',
        type: 'string',
        role: "info.status",
        read: true,
        write: false
      },
      native: {}
    });
    if (deviceclasses[i] != "Batterie") {
      adapter.setObjectNotExists('INV.' + names[i] + ".daysum", {
        type: 'state',
        common: {
          name: 'DaySum',
          desc: 'Daily sum Wh',
          type: 'number',
          role: "value.daysum",
          read: true,
          write: false,
          unit: "Wh"
        },
        native: {}
      });
    }
    adapter.setObjectNotExists('INV.' + names[i] + ".deviceclass", {
      type: 'state',
      common: {
        name: 'DeviceClass',
        desc: 'Device Class',
        type: 'string',
        role: "value.deviceclass",
        read: true,
        write: false
      },
      native: {}
    });

    adapter.setObjectNotExists('INV.' + names[i] + ".devicebrand", {
      type: 'state',
      common: {
        name: 'DeviceBrand',
        desc: 'Device brand',
        type: 'string',
        role: "value.devicebrand",
        read: true,
        write: false
      },
      native: {}
    });

    adapter.setObjectNotExists('INV.' + names[i] + ".devicetype", {
      type: 'state',
      common: {
        name: 'DeviceType',
        desc: 'Device type',
        type: 'string',
        role: "value.Devicetype",
        read: true,
        write: false
      },
      native: {}
    });


    if (deviceclasses[i] == "Batterie" && battdevicepresent == "true" && battpresent == "true") {
      adapter.setObjectNotExists("INV." + names[i] + '.ChargePower', {
        type: 'state',
        common: {
          name: 'chargepower',
          desc: 'Battery charging power',
          type: 'number',
          role: "value.chargepower",
          read: true,
          write: false,
          unit: "W"
        },
        native: {}
      });
      adapter.setObjectNotExists("INV." + names[i] + '.DischargePower', {
        type: 'state',
        common: {
          name: 'dischargepower',
          desc: 'Battery discharging power',
          type: 'number',
          role: "value.dischargepower",
          read: true,
          write: false,
          unit: "W"
        },
        native: {}
      });
      adapter.setObjectNotExists("INV." + names[i] + '.BattLevel', {
        type: 'state',
        common: {
          name: 'battlevel',
          desc: 'Battery Level',
          type: 'number',
          role: "value.battlevel",
          read: true,
          write: false,
          unit: "%"
        },
        native: {}
      });
      adapter.setObjectNotExists("INV." + names[i] + '.BattSelfCons', {
        type: 'state',
        common: {
          name: 'battselfcons',
          desc: 'Battery self consuption',
          type: 'number',
          role: "value.battselfcons",
          read: true,
          write: false,
          unit: "Wh"
        },
        native: {}
      });
      adapter.setObjectNotExists("INV." + names[i] + '.BattChargeDaysum', {
        type: 'state',
        common: {
          name: 'battchargedaysum',
          desc: 'Total battery charged today',
          type: 'number',
          role: "value.battchargedaysum",
          read: true,
          write: false,
          unit: "Wh"
        },
        native: {}
      });
      adapter.setObjectNotExists("INV." + names[i] + '.BattDischargeDaysum', {
        type: 'state',
        common: {
          name: 'battdischargedaysum',
          desc: 'Total battery diesemcharged today',
          type: 'number',
          role: "value.battdischargedaysum",
          read: true,
          write: false,
          unit: "Wh"
        },
        native: {}
      });
    }
  }

  if (battdevicepresent == "false" && battpresent == "true") {

    adapter.setObjectNotExists('INV.Battery.' + 'ChargePower', {
      type: 'state',
      common: {
        name: 'chargepower',
        desc: 'Battery charging power',
        type: 'number',
        role: "value.chargepower",
        read: true,
        write: false,
        unit: "W"
      },
      native: {}
    });
    adapter.setObjectNotExists('INV.Battery.' + 'DischargePower', {
      type: 'state',
      common: {
        name: 'dischargepower',
        desc: 'Battery discharging power',
        type: 'number',
        role: "value.dischargepower",
        read: true,
        write: false,
        unit: "W"
      },
      native: {}
    });
    adapter.setObjectNotExists('INV.Battery.' + 'BattLevel', {
      type: 'state',
      common: {
        name: 'battlevel',
        desc: 'Battery Level',
        type: 'number',
        role: "value.battlevel",
        read: true,
        write: false,
        unit: "%"
      },
      native: {}
    });
    adapter.setObjectNotExists("INV.Battery." + 'BattSelfCons', {
      type: 'state',
      common: {
        name: 'battselfcons',
        desc: 'Battery self consuption',
        type: 'number',
        role: "value.battselfcons",
        read: true,
        write: false,
        unit: "Wh"
      },
      native: {}
    });
    adapter.setObjectNotExists("INV.Battery." + 'BattChargeDaysum', {
      type: 'state',
      common: {
        name: 'battchargedaysum',
        desc: 'Total battery charged today',
        type: 'number',
        role: "value.battchargedaysum",
        read: true,
        write: false,
        unit: "Wh"
      },
      native: {}
    });
    adapter.setObjectNotExists("INV.Battery." + 'BattDischargeDaysum', {
      type: 'state',
      common: {
        name: 'battdischargedaysum',
        desc: 'Total battery diesemcharged today',
        type: 'number',
        role: "value.battdischargedaysum",
        read: true,
        write: false,
        unit: "Wh"
      },
      native: {}
    });
  }
  adapter.setObjectNotExists('SelfCons.selfconstoday', {
    type: 'state',
    common: {
      name: 'selfconstoday',
      desc: 'Total self consumption today',
      type: 'number',
      role: "value.selfconstoday",
      read: true,
      write: false,
      unit: "Wh"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsyesterday', {
    type: 'state',
    common: {
      name: 'selfconsyesterday',
      desc: 'Total self consumption yesterday',
      type: 'number',
      role: "value.selfconsyesterday",
      read: true,
      write: false,
      unit: "Wh"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsmonth', {
    type: 'state',
    common: {
      name: 'selfconsmonth',
      desc: 'Total self consumption this month',
      type: 'number',
      role: "value.selfconsmonth",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconslastmonth', {
    type: 'state',
    common: {
      name: 'selfconslastmonth',
      desc: 'Total self consumption last month',
      type: 'number',
      role: "value.selfconslastmonth",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsyear', {
    type: 'state',
    common: {
      name: 'selfconslastyear',
      desc: 'Total self consumption year',
      type: 'number',
      role: "value.selfconsyear",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconslastyear', {
    type: 'state',
    common: {
      name: 'selfconslastyear',
      desc: 'Total self consumption last year',
      type: 'number',
      role: "value.selfconslastyear",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsratiotoday', {
    type: 'state',
    common: {
      name: 'selfconsratiotoday',
      desc: 'Self consumption ratio today',
      type: 'number',
      role: "value.selfconsratiotoday",
      read: true,
      write: false,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsratioyesterday', {
    type: 'state',
    common: {
      name: 'selfconsratioyesterday',
      desc: 'self consumption ratio yesterday',
      type: 'number',
      role: "value.selfconsratioyesterday",
      read: true,
      write: false,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsratiomonth', {
    type: 'state',
    common: {
      name: 'selfconratiosmonth',
      desc: 'self consumption ratio this month',
      type: 'number',
      role: "value.selfconsratiomonth",
      read: true,
      write: false,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsratiolastmonth', {
    type: 'state',
    common: {
      name: 'selfconsratiolastmonth',
      desc: 'self consumption ratio last month',
      type: 'number',
      role: "value.selfconsratiolastmonth",
      read: true,
      write: false,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsratioyear', {
    type: 'state',
    common: {
      name: 'selfconsratioyear',
      desc: 'self consumption ratio year',
      type: 'number',
      role: "value.selfconsratioyear",
      read: true,
      write: false,
      unit: "%"
    },
    native: {}
  });
  adapter.setObjectNotExists('SelfCons.selfconsratiolastyear', {
    type: 'state',
    common: {
      name: 'selfconsratiolastyear',
      desc: 'self consumption ratio last year',
      type: 'number',
      role: "value.selfconsratiolastyear",
      read: true,
      write: false,
      unit: "%"
    },
    native: {}
  });
} //End setInvObjects

function setdeviceinfo() {
  for (var i = 0; i < (numinv - 1); i++) {
    adapter.setState("INV." + names[i] + ".deviceclass", deviceclasses[i], true);
    adapter.setState("INV." + names[i] + ".devicetype", devicetypes[i], true);
    adapter.setState("INV." + names[i] + ".devicebrand", devicebrands[i], true);
  }
  if (forecast = "true") {
    setforecastobjects();
  } else {
    httpsReqDataStandard(cmd, uzimp);
  }
} //End setdeviceinfo

function setforecastobjects() {
  adapter.setObjectNotExists('info.latitude', {
    type: 'state',
    common: {
      name: 'latitude',
      desc: 'plant latitude',
      type: 'string',
      role: "value.latitude",
      read: true,
      write: false,
      unit: "°"
    },
    native: {}
  });
  adapter.setObjectNotExists('info.longitude', {
    type: 'state',
    common: {
      name: 'longitude',
      desc: 'plant longitude',
      type: 'string',
      role: "value.longitude",
      read: true,
      write: false,
      unit: "°"
    },
    native: {}
  });
  adapter.setObjectNotExists('info.inclination', {
    type: 'state',
    common: {
      name: 'inclination',
      desc: 'plant inclination',
      type: 'string',
      role: "value.inclination",
      read: true,
      write: false,
      unit: "°"
    },
    native: {}
  });
  adapter.setObjectNotExists('info.azimuth', {
    type: 'state',
    common: {
      name: 'azimuth',
      desc: 'plant azimuth',
      type: 'string',
      role: "value.azimuth",
      read: true,
      write: false,
      unit: "°"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.today', {
    type: 'state',
    common: {
      name: 'forecastToday',
      desc: 'forecast for todays total kWh',
      type: 'string',
      role: "value.forecastToday",
      read: true,
      write: false,
      unit: "Wh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.tomorrow', {
    type: 'state',
    common: {
      name: 'forecastTomorrow',
      desc: 'forecast for tomorrows total kWh',
      type: 'string',
      role: "value.forecastTomorrow",
      read: true,
      write: false,
      unit: "Wh"
    },
    native: {}
  });
  getforecastdata();
  setTimeout(function() {
    httpsReqDataStandard(cmd, uzimp);
  }, 1000);

} //end setforecastobjects()

function httpsReqSumYearUZ(cmd, names) { //Abfrage der Jahressummen Unterz�hlerwerte
  // create Channel Historic
  adapter.setObjectNotExists('Historic', {
    type: 'channel',
    role: '',
    common: {
      name: "Historic Data"
    },
    native: {}
  });
  var data = '{"854":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        var dataYear = JSON.parse(body)[854];
        adapter.log.debug("DataYear: " + dataYear);
        adapter.log.debug("Inv. to treat: " + names);
        var namLeng = names.length;

        adapter.log.debug("Anzahl Elemente: " + namLeng);
        for (var iy = 0; iy < dataYear.length; iy++) {
          var year = dataYear[iy][0].slice(-2);
          for (var inu = 0; inu < names.length; inu++) {
            if (dataYear[iy][1][inu] != 0) {
              adapter.setObjectNotExists('Historic.' + "20" + year + ".yieldyearINV." + names[inu], {
                type: 'state',
                common: {
                  name: 'yieldyear',
                  desc: 'Year sum Wh',
                  type: 'number',
                  role: "value.yearsum",
                  read: true,
                  write: false,
                  unit: "Wh"
                },
                native: {}
              });
            }
          }
        }
        for (var iy = 0; iy < dataYear.length; iy++) {
          var year = dataYear[iy][0].slice(-2);
          for (var inu = 0; inu < names.length; inu++) {
            if (dataYear[iy][1][inu] != 0) {
              adapter.setState('Historic.' + "20" + year + ".yieldyearINV." + names[inu], dataYear[iy][1][inu], true);
            }
          }
        }
        adapter.log.debug("END");
        httpsReqSumYear(cmd, names);
      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler SumYearUZ: " + e.message);
      }

    });

  });




  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR SumYearUZ: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqSumYearUZ

function httpsReqSumYear(cmd, names) { //Abfrage der Jahressummen Unterz�hlerwerte
  // create Channel Historic

  var data = '{"878":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        var dataYeartot = JSON.parse(body)[878];
        adapter.log.debug("DataYear: " + dataYeartot);

        for (var iy = 0; iy < dataYeartot.length; iy++) {
          var year = dataYeartot[iy][0].slice(-2);

          adapter.setObjectNotExists('Historic.' + "20" + year + ".yieldyear", {
            type: 'state',
            common: {
              name: 'yieldyear',
              desc: 'Year sum producion Wh',
              type: 'number',
              role: "value.yearsum",
              read: true,
              write: false,
              unit: "Wh"
            },
            native: {}
          });

          adapter.setObjectNotExists('Historic.' + "20" + year + ".consyear", {
            type: 'state',
            common: {
              name: 'consyear',
              desc: 'Year sum consumption Wh',
              type: 'number',
              role: "value.yearsum",
              read: true,
              write: false,
              unit: "Wh"
            },
            native: {}
          });

          adapter.setObjectNotExists('Historic.' + "20" + year + ".selfconsyear", {
            type: 'state',
            common: {
              name: 'selfconsyear',
              desc: 'Year sum  self consumption Wh',
              type: 'number',
              role: "value.yearsum",
              read: true,
              write: false,
              unit: "kWh"
            },
            native: {}
          });


        }
        for (var iy = 0; iy < dataYeartot.length; iy++) {
          var year = dataYeartot[iy][0].slice(-2);
          if (dataYeartot[iy][1] != 0) {
            adapter.setState('Historic.' + "20" + year + ".yieldyear", dataYeartot[iy][1], true);
            adapter.setState('Historic.' + "20" + year + ".consyear", dataYeartot[iy][2], true);
            adapter.setState('Historic.' + "20" + year + ".selfconsyear", dataYeartot[iy][3], true);
          }

        }

        adapter.setState('SelfCons.selfconsyear', dataYeartot[dataYeartot.length - 1][3], true);
        adapter.setState('SelfCons.selfconslastyear', dataYeartot[dataYeartot.length - 2][3], true);

        adapter.setState('SelfCons.selfconsratioyear', Math.round((dataYeartot[dataYeartot.length - 1][3] * 1000) / (dataYeartot[dataYeartot.length - 1][2]) * 1000) / 10, true);
        adapter.setState('SelfCons.selfconsratiolastyear', Math.round((dataYeartot[dataYeartot.length - 2][3] * 1000) / (dataYeartot[dataYeartot.length - 2][2]) * 1000) / 10, true);

        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler SumYear: " + e.message);
      }
      httpsReqSumMonth(cmd, names);
    });

  });


  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR SumYear: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqSumYear

function httpsReqSumMonth(cmd, names) { //Abfrage der Jahressummen Unterz�hlerwerte
  // create Channel Historic

  var data = '{"877":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        var dataMonthtot = JSON.parse(body)[877];
        adapter.log.debug("DataMonth: " + dataMonthtot);

        for (var iy = 0; iy < dataMonthtot.length; iy++) {
          var year = dataMonthtot[iy][0].slice(-2);
          var month = dataMonthtot[iy][0].slice(3, 5);

          adapter.setObjectNotExists('Historic.' + "20" + year + ".monthly." + month + ".yieldmonth", {
            type: 'state',
            common: {
              name: 'yieldmonth',
              desc: 'Month sum producion Wh',
              type: 'number',
              role: "value.monthsum",
              read: true,
              write: false,
              unit: "Wh"
            },
            native: {}
          });

          adapter.setObjectNotExists('Historic.' + "20" + year + ".monthly." + month + ".consmonth", {
            type: 'state',
            common: {
              name: 'consmonth',
              desc: 'Month sum consumption Wh',
              type: 'number',
              role: "value.monthsum",
              read: true,
              write: false,
              unit: "Wh"
            },
            native: {}
          });

          adapter.setObjectNotExists('Historic.' + "20" + year + ".monthly." + month + ".selfconsmonth", {
            type: 'state',
            common: {
              name: 'selfconsmonth',
              desc: 'Month sum  self consumption Wh',
              type: 'number',
              role: "value.monthsum",
              read: true,
              write: false,
              unit: "kWh"
            },
            native: {}
          });


        }
        for (var iy = 0; iy < dataMonthtot.length; iy++) {
          var year = dataMonthtot[iy][0].slice(-2);
          var month = dataMonthtot[iy][0].slice(3, 5);

          if (dataMonthtot[iy][1] != 0) {
            adapter.setState('Historic.' + "20" + year + ".monthly." + month + ".yieldmonth", dataMonthtot[iy][1], true);
            adapter.setState('Historic.' + "20" + year + ".monthly." + month + ".consmonth", dataMonthtot[iy][2], true);
            adapter.setState('Historic.' + "20" + year + ".monthly." + month + ".selfconsmonth", dataMonthtot[iy][3], true);
          }

        }
        adapter.setState('SelfCons.selfconsmonth', dataMonthtot[dataMonthtot.length - 1][3], true);
        adapter.setState('SelfCons.selfconslastmonth', dataMonthtot[dataMonthtot.length - 2][3], true);

        adapter.setState('SelfCons.selfconsratiomonth', Math.round((dataMonthtot[dataMonthtot.length - 1][3] * 1000) / (dataMonthtot[dataMonthtot.length - 1][2]) * 1000) / 10, true);
        adapter.setState('SelfCons.selfconsratiolastmonth', Math.round((dataMonthtot[dataMonthtot.length - 2][3] * 1000) / (dataMonthtot[dataMonthtot.length - 2][2]) * 1000) / 10, true);

        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler SumMonth: " + e.message);
      }

    });

  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR SumYear: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqSumMonth


function httpsReqDataStandard(cmd) { //Abfrage der Standardwerte
  var data = '{"801":{"170":null}}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };
  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);
    }).on('end', function() {
      adapter.log.debug("no more date in response");

      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).

      try {
        json = (JSON.parse(body));
        adapter.log.debug("Body: " + body);
        adapter.setState('info.lastSync', json[801][170][100], true);
        adapter.setState('info.totalPower', json[801][170][116], true);
        adapter.setState('status.pac', json[801][170][101], true);
        adapter.setState('status.pdc', json[801][170][102], true);
        adapter.setState('status.uac', json[801][170][103], true);
        adapter.setState('status.udc', json[801][170][104], true);
        adapter.setState('status.conspac', json[801][170][110], true);
        adapter.setState('status.yieldday', json[801][170][105], true);
        adapter.setState('status.yieldyesterday', json[801][170][106], true);
        adapter.setState('status.yieldmonth', json[801][170][107], true);
        adapter.setState('status.yieldyear', json[801][170][108], true);
        adapter.setState('status.yieldtotal', json[801][170][109], true);
        adapter.setState('status.consyieldday', json[801][170][111], true);
        adapter.setState('status.consyieldyesterday', json[801][170][112], true);
        adapter.setState('status.consyieldmonth', json[801][170][113], true);
        adapter.setState('status.consyieldyear', json[801][170][114], true);
        adapter.setState('status.consyieldtotal', json[801][170][115], true);
      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler DataStandard: " + e.message);
      }
      adapter.log.debug("Batteriestatus: " + battpresent);
      if (battpresent == "true") {
        adapter.log.debug("Batterie vorhanden: " + battpresent);
        httpsReqBattData(cmd, names);
      } else {
        adapter.log.debug("Keine Batterie");
        adapter.log.debug("InvImp= " + uzimp);
        if (uzimp == "true") {
          adapter.log.debug("Unterzaehler importieren");
          httpsReqDataUZ(cmd, names);
        }
      }

    });
  });


  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR ReqDataStandard: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
  req.end();

} //end httpsReqDataStandard()

function httpsReqBattData() { //Abfrage der Jahressummen Unterz�hlerwerte

  var data = '{"858":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        battdata = JSON.parse(body)[858];
        adapter.log.debug("Battdata: " + battdata);
        if (battdevicepresent == "true" && battpresent == "true") {
          adapter.setState("INV." + names[battindex[0]] + '.BattLevel', battdata[1], true);
          adapter.setState("INV." + names[battindex[0]] + '.ChargePower', battdata[2], true);
          adapter.setState("INV." + names[battindex[0]] + '.DischargePower', battdata[3], true);
        } else if (battdevicepresent == "false" && battpresent == "true") {
          adapter.setState('INV.Battery.BattLevel', battdata[1], true);
          adapter.setState('INV.Battery.ChargePower', battdata[2], true);
          adapter.setState('INV.Battery.DischargePower', battdata[3], true);
        } else {
          adapter.log.debug("Strange: Batteriedaten vorhanden aber Batterie - Vorhanden Indikatoren falsch")
        }
        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler httpsReqBattdata: " + e.message);
      }
      adapter.log.debug("InvImp= " + uzimp);
      if (uzimp == "true") {
        adapter.log.debug("Unterzaehler importieren");
        httpsReqDataUZ(cmd, names);
      }
    });
  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR httpsReqBattdata: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqBattData

function httpsReqDataUZ(cmd, names) { //Abfrage der Unterz�hlerwerte
  var data = '{"782":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        var dataJUZ = (JSON.parse(body));
        adapter.log.debug("Inv. to treat: " + names);
        var namLeng = names.length;
        adapter.log.debug("Anzahl Elemente: " + namLeng);
        for (var uzi = 0; uzi < namLeng; uzi++) {
          if (deviceclasses[uzi] != "Batterie") {
            adapter.log.debug("INV." + names[uzi] + ": " + dataJUZ[782][uzi]);
            adapter.setState("INV." + names[uzi] + ".PAC", dataJUZ[782][uzi], true);
          }
        }
        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler DataUZ: " + e.message);
      }
      httpsReqStatUZ(cmd, names);

    });

  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR ReqDataUZ: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqDataUZ

function httpsReqStatUZ(cmd, names) { //Abfrage der Unterz�hlerwerte
  var data = '{"608":null}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);
      try {
        var dataJSUZ = (JSON.parse(body));
        adapter.log.debug("Inv. to treat: " + names);
        var namLeng = names.length;
        adapter.log.debug("Anzahl Elemente: " + namLeng);
        for (var uzj = 0; uzj < namLeng; uzj++) {
          adapter.log.debug("INV." + names[uzj] + ": " + dataJSUZ[608][uzj]);
          adapter.setState("INV." + names[uzj] + ".status", dataJSUZ[608][uzj], true);
        }
        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler StatUZ: " + e.message);
      }
      httpsReqDataSumUZ(cmd, names);
    });

  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.debug('ERROR ReqStatUZ: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.debug("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqStatUZ

function httpsReqDataSumUZ(cmd, names) { //Abfrage der Unterz�hlerwerte
  var data = '{"777":{"0":null}}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        var dataSUZ = JSON.parse(body)[777][0];
        adapter.log.debug("DataSUZ: " + dataSUZ);
        adapter.log.debug("Inv. to treat: " + names);
        var namLeng = names.length;
        adapter.log.debug("Anzahl Elemente: " + namLeng);
        var d = new Date();
        var heute = (("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + (d.getFullYear().toString()).slice(-2)).toString();
        adapter.log.debug("Heute: " + heute);
        for (var isuz = 0; isuz < 31; isuz++) {
          var indextag = dataSUZ[isuz].indexOf(heute.toString());
          if (indextag != -1) {
            var indexsuz = isuz;
            adapter.log.debug("Index Tageswerte: " + indexsuz);
            break;
          }
        }
        var daysum = dataSUZ[indexsuz][1];
        adapter.log.debug("Tagessummen: " + daysum);
        for (var suzi = 0; suzi < namLeng; suzi++) {
          if (deviceclasses[suzi] != "Batterie") {
            adapter.log.debug("INV." + names[suzi] + ": " + daysum[suzi]);
            adapter.setState("INV." + names[suzi] + ".daysum", daysum[suzi], true);
          }
        }
        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler DataSUZ: " + e.message);
      }
      httpsReqDataSelfCons();
    });
  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR ReqDataUZ: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqDataSumUZ

function httpsReqDataSelfCons() { //Abfrage der Unterz�hlerwerte
  var data = '{"778":{"0":null}}';
  var options = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
      'Content-Type': 'application/json',
      'Accept': 'applciation/json',
      'Content-Length': data.length
    }
  };

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (R�ckmeldung vom Webserver)
    var bodyChunks = [];
    var chunkLine = 0;
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier k�nnen die einzelnen Zeilen verarbeitet werden...
      bodyChunks.push(chunk);

    }).on('end', function() {
      var body = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + body);

      try {
        var dataselfcons = JSON.parse(body)[778][0];
        adapter.log.debug("DataSelfCons: " + dataselfcons);
        var d = new Date();
        var heute = (("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + (d.getFullYear().toString()).slice(-2)).toString();
        adapter.log.debug("Heute: " + heute);
        var monatheute = d.getMonth() + 1;
        adapter.log.debug("Monat heute: " + monatheute);
        for (var isuz = 0; isuz < 31; isuz++) {
          var indextag = dataselfcons[isuz].indexOf(heute.toString());
          if (indextag != -1) {
            var indexsuz = isuz;
            adapter.log.debug("Index Tageswerte: " + indexsuz);
            break;
          }
        }
        var dataselfconstoday = dataselfcons[indexsuz];
        adapter.log.debug("Tageswerte SelfCons: " + dataselfconstoday);
        var daysum = dataselfcons[indexsuz][1];
        adapter.log.debug("Tagessumme Eigenverbrauch: " + daysum);
        var dayratio = Math.round((daysum / json[801][170][105]) * 1000) / 10;


        adapter.setState("SelfCons.selfconstoday", daysum, true);
        adapter.setState("SelfCons.selfconsratiotoday", dayratio, true);

        d.setDate(d.getDate() - 1);
        var gestern = (("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + (d.getFullYear().toString()).slice(-2)).toString();
        adapter.log.debug("Gestern: " + gestern);
        var monatgestern = d.getMonth() + 1;
        adapter.log.debug("Monat gestern: " + monatgestern);
        if (monatgestern == monatheute) {
          for (var iscy = 0; iscy < 31; iscy++) {
            var indexgestern = dataselfcons[iscy].indexOf(gestern.toString());
            if (indexgestern != -1) {
              var indexscy = iscy;
              adapter.log.debug("Index Tageswerte gestern: " + indexscy);
              break;
            }
          }
          var dataselfconsyesterday = dataselfcons[indexscy];
          adapter.log.debug("Gesternwerte SelfCons: " + dataselfconsyesterday);
          var daysumy = dataselfcons[indexscy][1];
          adapter.log.debug("Gesternsumme Eigenverbrauch: " + daysumy);
          var dayratioy = Math.round((daysumy / json[801][170][106]) * 1000) / 10;

          adapter.setState("SelfCons.selfconsyesterday", daysumy, true);
          adapter.setState("SelfCons.selfconsratioyesterday", dayratioy, true);
          lastdaysumy = daysum;
          lastdayratioy = dayratio;
        } else {
          adapter.setState("SelfCons.selfconsyesterday", lastdaysumy, true);
          adapter.setState("SelfCons.selfconsratioyesterday", lastdayratioy, true);
        }

        if (battdevicepresent == "true" && battpresent == "true") {
          adapter.setState("INV." + names[battindex[0]] + '.BattSelfCons', dataselfconstoday[2], true);
          adapter.setState("INV." + names[battindex[0]] + '.BattChargeDaysum', dataselfconstoday[3], true);
          adapter.setState("INV." + names[battindex[0]] + '.BattDischargeDaysum', dataselfconstoday[4], true);
        } else if (battdevicepresent == "false" && battpresent == "true") {
          adapter.setState('INV.Battery.BattSelfCons', dataselfconstoday[2], true);
          adapter.setState('INV.Battery.BattChargeDaysum', dataselfconstoday[3], true);
          adapter.setState('INV.Battery.BattDischargeDaysum', dataselfconstoday[4], true);
        } else if (battdevicepresent == "false" && battpresent == "false") {
          adapter.log.debug("Keine Batterie vorhanden");
        } else {
          adapter.log.debug("Strange: Batteriedaten vorhanden aber Batterie - Vorhanden Indikatoren falsch")
        }

        adapter.log.debug("END");

      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler DataSelfCons: " + e.message);
      }

    });
  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR DataSelfCons: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
} //End httpsReqDataSelfCons

function getforecastdata() {
  cmdforecast = "estimate/";
  lat = adapter.config.latitude;
  lon = adapter.config.longitude;
  dec = adapter.config.inclination;
  az = adapter.config.azimuth;
  adapter.getState("info.totalPower", function(err, obj) {
    if (obj) {
      kwp = obj.val / 1000;
      var options = {
        url: urlforecast + cmdforecast + lat + "/" + lon + "/" + dec + "/" + az + "/" + kwp,
        json: true,
        headers: {
          'content-type': 'application/json'
        }
      };

      adapter.log.debug("options: " + JSON.stringify(options));

      request.get(options, function(error, response, body) {
        if (error) {
          adapter.log.warn("Error request forecastdata: " + error);
        } else {
          try {
            adapter.log.debug("Response: " + JSON.stringify(response));
            var watthoursday = response["body"]["result"]["watt_hours_day"];
            adapter.log.debug("WatthoursDay = " + JSON.stringify(watthoursday));
            var watthourstoday = parseInt(response["body"]["result"]["watt_hours_day"][new Date().toISOString().slice(0, 10)]);
            adapter.log.debug("Vorhersage für heute, " + new Date().toISOString().slice(0, 10) + ": " + watthourstoday);
            var tomorrow = new Date();
            tomorrow.setDate(new Date().getDate() + 1);
            var watthourstomorrow = parseInt(response["body"]["result"]["watt_hours_day"][tomorrow.toISOString().slice(0, 10)]);
            adapter.log.debug("Vorhersage für morgen, " + tomorrow.toISOString().slice(0, 10) + ": " + watthourstomorrow);

            adapter.setState('forecast.today', watthourstoday, true);
            adapter.setState('forecast.tomorrow', watthourstomorrow, true);
            adapter.setState('info.latitude', lat, true);
            adapter.setState('info.longitude', lon, true);
            adapter.setState('info.inclination', dec, true);
            adapter.setState('info.azimuth', az, true);

          } catch (e) {
            adapter.log.warn("Getforecastdata - Error: " + e);
          }

        }
      });
    } else {
      adapter.log.warn("Prognosefehler: Anlageleistung nicht verfügbar");
    }
  });
} //end getforecastdata()


// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
  module.exports = startAdapter;
} else {
  // or start the instance directly
  startAdapter();
} // endElse
