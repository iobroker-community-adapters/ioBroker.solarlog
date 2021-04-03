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

var requestcounter = 0;
var datatoken = "";

var optionsdefault = {};
var statusuz = "on";

var devicelist = [];
var brandlist = [];
var deviceclasslist = ["Wechselrichter", "Sensor", "Zähler", "Hybrid-System", "Batterie", "Intelligente Verbraucher", "Schalter", "Wärmepumpe", "Heizstab", "Ladestation"];
var numinv = 0;
var names = [];
var numsg = 0;
const namessg = new Array(10);

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
var feed = 0;

var historic = "false";
var histcron = "0 0 * * *"

var forecast = "false";
var urlforecast = "https://api.forecast.solar/";
var cmdforecast;
var lat;
var lon;
var dec;
var az;
var kwp;

var userpass = "false";
var userpw = "";
var logindata = "";
var token = "";

var reqdata;

var startupData = '{"152":null,"161":null,"162":null,"447":null,"610":null,"611":null,"617":null,"706":null,"739":null,"740":null,"744":null,"800":{"100":null,"160":null},"801":{"101":null,"102":null},"858":null,"895":{"100":null,"101":null,"102":null,"103":null,"104":null,"105":null}}';
var inverterDataArray = [];
var pollingData = '{"447":null,"777":{"0":null},"778":{"0":null},"801":{"170":null}}';
var historicData = '{"854":null,"877":null,"878":null}';
var fastpollData = '{"608":null,"780":null,"781":null,"782":null,"794":{"0":null},"801":{"175":null},"858":null}';

let polling;
let fastpolling;

function startAdapter(options) {
  options = options || {};
  Object.assign(options, {
    name: 'solarlog'
  });

  adapter = new utils.Adapter(options);

  // when adapter shuts down
  adapter.on('unload', function(callback) {
    try {
      clearTimeout(polling);
      clearTimeout(fastpolling);
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
  historic = (adapter.config.historic).toString();
  histcron = (adapter.config.histmin) + " " + (adapter.config.histhour) + " * * *"
  userpass = (adapter.config.userpass).toString();
  logindata = "u=user&p=" + (adapter.config.userpw);
  optionsdefault = {
    host: DeviceIpAdress,
    port: Port,
    path: cmd,
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate',
      //'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
      'Connection': 'keep-alive',
      //'Content-Length': data.length,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Referer': 'http://' + DeviceIpAdress + '/',
      'Accept-Origin': 'http://' + DeviceIpAdress + '/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Safari/537.36',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': 'banner_hidden=false; SolarLog=' + datatoken
    }
  };

  adapter.log.debug("LOVE - Ich liebe euch!"); //eingefügt auf Wunsch von meiner Tochter)

  adapter.log.info("Unterzähler - Import: " + adapter.config.invimp);
  adapter.log.debug("uzimp: " + uzimp);
  if (historic == "true") {
    adapter.log.info("Rufe historische Daten um " + adapter.config.histhour + ":" + adapter.config.histmin + " ab");
  } else {
    adapter.log.info("Historische Daten werden nicht abgerufen");
  }
  adapter.log.info("Forecast - Datenabruf: " + forecast);
  const pollingTimecurrent = (adapter.config.pollIntervalcurrent * 1000) || 30000;
  const pollingTimeperiodic = (adapter.config.pollIntervalperiodic * 60000) || 300000;
  adapter.log.debug('[INFO] Configured polling interval consuption/production: ' + pollingTimecurrent);
  adapter.log.debug('[INFO] Configured polling interval averages&other: ' + pollingTimeperiodic);
  adapter.log.debug('[START] Started Adapter with: ' + adapter.config.host);

  if (userpass == "true") {
    login();
  }

  if (uzimp == "true") {
    adapter.log.debug("uzimp: " + uzimp);
    adapter.log.debug("WR Importieren");

    setTimeout(function() {
      logcheck(startupData);
    }, 500);


    testend = setInterval(test, 2000); //�berpr�fen ob alle Channels angelegt sind.

    if (!fastpolling) {
      fastpolling = setTimeout(function repeat() { // poll states every [30] seconds
        logcheck(fastpollData);
        setTimeout(repeat, pollingTimecurrent);
      }, pollingTimecurrent + 20000);
    } // endIf

    if (!polling) {
      polling = setTimeout(function repeat() { // poll states every [30] seconds
        setTimeout(function() {
          logcheck(pollingData);
        }, 500);
        setTimeout(repeat, pollingTimeperiodic);
      }, pollingTimeperiodic);
    } // endIf

  } else {
    adapter.log.debug("uzimp: " + uzimp);
    adapter.log.debug("WR nicht Importieren");
    if (forecast == "true") {
      setforecastobjects();
    } else {
      logcheck('{"801":{"170":null}}');
    }

    if (!polling) {
      polling = setTimeout(function repeat() { // poll states every [30] seconds
        logcheck('{"801":{"170":null}}');
        setTimeout(repeat, pollingTimecurrent);
      }, pollingTimecurrent)
    }
  }

  var jedentag = schedule.scheduleJob(histcron, function() {
    if (historic == "true") {
      adapter.log.info('Langzeitwerte abrufen');
      logcheck(historicData);
    } else {
      adapter.log.debug("Abruf historische Werte nich aktiviert");
    }
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
        adapter.log.info("Alle WR/Zaehler gefunden");
        adapter.log.debug("Names: " + names);
        setdeviceinfo(names);
      } else {
        testi = 0;
        adapter.log.warn("Nicht alle WR/Zaehler gefunden");
        testj++;
        if (testj > 5) {
          adapter.log.warn("Fehler, noch nicht alle Unterzaehler angelegt");
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

function login() {
  var data = logindata;
  var options = optionsdefault;
  options.path = "/login";
  options.headers['Cookie'] = 'banner_hidden=false';
  options.headers['Content-Length'] = data.length;

  adapter.log.debug("Options: " + JSON.stringify(options));
  adapter.log.debug("starte LOGIN");

  var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
    adapter.log.debug('COOKIE: ' + JSON.stringify(res.headers["set-cookie"]));

    try {
      token = JSON.stringify(res.headers["set-cookie"].toString());
      datatoken = token.slice(10, -1);
      adapter.log.debug("TOKEN: " + token);
      adapter.log.debug("DATATOKEN: " + datatoken);
      var bodyChunks = [];
      var chunkLine = 0;
    } catch (e) {
      adapter.log.warn("Fehler Login: " + e.message + " Benuterpasswort im Solalog aktiviert??");
    }
    res.on('data', function(chunk) {
      chunkLine = chunkLine + 1;
      // Hier können die einzelnen Zeilen verarbeitet werden...
      try {
        bodyChunks.push(chunk);
      } catch (e) {
        adapter.log.warn("Fehler Login: " + e.message + " Benuterpasswort im Solalog aktiviert??");
      }
    }).on('end', function() {
      try {
        var body = Buffer.concat(bodyChunks);
      } catch (e) {
        adapter.log.warn("Fehler Login: " + e.message + " Benuterpasswort im Solalog aktiviert??");
      }
    });
  });

  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body LI: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.debug("Daten: keine Daten im Body angegeben angegeben"));

  req.end();
}; //END login

function logcheck(datalc) {
  if (userpass == "false") {
    httpsRequest(datalc);
  } else {
    var data = ""
    var options = optionsdefault;
    options.path = "/logcheck?";
    options.headers['Cookie'] = 'banner_hidden=false; SolarLog=' + datatoken;
    options.headers['Content-Length'] = data.length;

    adapter.log.debug("Options: " + JSON.stringify(options));
    adapter.log.debug("Starte Logcheck");

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
        var bodyl = Buffer.concat(bodyChunks);
        var bodystring = bodyl.toString();
        var bodyarray = bodystring.split(";");

        adapter.log.debug("bodyraw: " + bodyl);
        adapter.log.debug("bodyarray0= " + bodyarray[0]);

        //logcheck: 0;0;1 = nicht angemeldet, 1;2;2= installateur 1;3;3 =inst/pm 1;1;1 =benutzer
        if (bodyarray[0] != 0) {
          adapter.log.debug("login OK, starte Request");
          httpsRequest(datalc);
        } else {
          adapter.log.warn("login NICHT OK, starte zuerst Login, danach Request");
          login();
          setTimeout(function() {
            logcheck(datalc);
          }, 2000)
        }
      });;
    });

    req.on('error', function(e) { // Fehler abfangen
      adapter.log.warn('ERROR: ' + e.message, "warn");
    });

    adapter.log.debug("Data to request body LC: " + data);
    // write data to request body
    (data ? req.write(data) : adapter.log.debug("Daten: keine Daten im Body angegeben angegeben"));

    req.end();
  }
}; //logcheck END

function httpsRequest(reqdata) { //Führt eine Abfrage beim solarlog durch und übergibt das REsultat zur Auswertung.
  var data = 'token=' + datatoken + ';preval=none;' + reqdata;

  adapter.log.debug("DATA: " + data + "DATALENGTH: " + data.length)
  var options = optionsdefault;
  options.path = cmd;
  options.headers['Content-Length'] = data.length;

  adapter.log.debug("OPTIONS: " + JSON.stringify(options));

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
      var bodyr = Buffer.concat(bodyChunks);
      // ...und/oder das Gesamtergebnis (body).
      adapter.log.debug("body: " + bodyr);
      try {
        if (res.statusCode == 200) {
          requestcounter = 0;
          readSolarlogData(reqdata, bodyr);
        } else {
          if (requestcounter > 4) {
            adapter.log.warn('Mehrfach fehlerhafter http-Request, starte Adapter neu.')
            restartAdapter();
          } else if (requestcounter > 3) {
            adapter.log.info('Mehrfacher Fehler beim http-request: Statuscode:' + res.statusCode + '. Führe Request in 60 Sekunden erneut aus.')
            requestcounter++;
            setTimeout(function() {
              httpsRequest(reqdata);
            }, 90000);
          } else {
            adapter.log.info('Fehler beim http-request: Statuscode:' + res.statusCode + '. Führe Request in 10 Sekunden erneut aus.')
            requestcounter++;
            setTimeout(function() {
              httpsRequest(reqdata);
            }, 10000);
          }
        }
      } catch (e) {
        adapter.log.warn("JSON-parse-Fehler httpsRequest: " + e.message);
      }

      adapter.log.debug("END Request: " + JSON.stringify(data));

    });
  });
  req.on('error', function(e) { // Fehler abfangen
    adapter.log.warn('ERROR httpsRequest: ' + e.message, "warn");
  });

  adapter.log.debug("Data to request body: " + data);
  // write data to request body
  (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
  req.end();
} //end httpsRequest

function readSolarlogData(reqdata, resdata) {
  try {
    adapter.log.debug("Verarbeite Daten");
    adapter.log.debug("Datensatz: " + reqdata);
    adapter.log.debug("Auswertedaten: " + resdata);

    switch (reqdata.slice(0, 6)) {
      case '{"141"': //inverter names and deviceinfo-code
        try {
          var dataJuzna = JSON.parse(resdata)[141];

          for (var y = 0; y < (numinv - 1); y++) {
            names.push(dataJuzna[y][119]);
            adapter.log.debug("Inverters: " + names);
            deviceinfos.push(dataJuzna[y][162]);
            adapter.log.debug("Deviceinfos: " + deviceinfos);
          }

          defdeviceinfo();

        } catch (e) {
          adapter.log.warn("JSON-parse-Fehler inverter names/deviceinfo: " + e.message);
          throw e;
        }

        break;

      case '{"152"': //var startupData = ''{"152":null,"161":null,"162":null,"447":null,"610":null,"611":null,"617":null,"706":null,"739":null,"740":null,"744":null,"800":{"100":null,"160":null},"801":{"101":null,"102":null},"858":null,"895":{"100":null,"101":null,"102":null,"103":null,"104":null,"105":null}}';

        try { //"739":null,"744":null
          devicelist = JSON.parse(resdata)[739];
          adapter.log.debug("Devicelist: " + devicelist);
          brandlist = JSON.parse(resdata)[744];
          adapter.log.debug("Brandlist: " + brandlist);
        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in get devicelist/brandlist: " + e);
          throw e
        }

        try { //"740":null
          var dataJ = JSON.parse(resdata)[740];
          adapter.log.debug("List of Inverters: " + dataJ);
          while (statusuz != "Err" && numinv < 100) {
            statusuz = (dataJ[numinv.toString()]);
            numinv++;
          }
          adapter.setState('info.numinv' /*numinv*/ , numinv - 1, true);
          adapter.log.debug("Numer of inverters/meters :" + (numinv - 1));


          for (var i = 0; i < (numinv - 1); i++) {
            var datafront = '{"141":{';
            var dataelements = '":{"119":null,"162":null}';
            inverterDataArray.push('"' + i.toString() + dataelements);
          }

          var inverterData = datafront + inverterDataArray.toString() + '}}';

          logcheck(inverterData);

        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in get numinv: " + e);
          throw e
        }

        try { //"447":null
          var sgdata = JSON.parse(resdata)[447];
          adapter.log.debug("Schaltgruppendaten: " + sgdata);
          for (var isg = 0; isg < 10; isg++) {
            var sgname = JSON.parse(resdata)[447][isg][100];
            if (sgname != "") {
              adapter.log.debug("neue Schaltgruppe: " + sgname);
            }
            namessg[isg] = sgname.replace(/\s+/g, '');
          }
          adapter.log.debug("Anzahl Schaltgruppen: " + namessg.filter(Boolean).length)
          numsg = namessg.filter(Boolean).length;
          adapter.log.debug("namessg = " + namessg);
          adapter.log.debug("Schaltgruppen neu: " + namessg.filter(function() {
            return true
          }));

        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in get switchgrouplist: " + e);
          throw e
        }

        try { //"610":null,"611":null,"617":null,"706":null,"800":{"100":null,"160":null},"801":{"101":null,"102":null},"858":null,"895":{"100":null,"101":null,"102":null,"103":null,"104":null,"105":null}

          adapter.setState('info.RTOS', JSON.parse(resdata)[610], true);
          adapter.setState('info.CLIB', JSON.parse(resdata)[611], true);
          adapter.setState('info.MAC', JSON.parse(resdata)[617], true);
          adapter.setState('info.SN', JSON.parse(resdata)[706], true);
          adapter.setState('info.Model', JSON.parse(resdata)[800][100], true);
          adapter.setState('info.InstDate', JSON.parse(resdata)[800][160], true);
          adapter.setState('info.FW', JSON.parse(resdata)[801][101], true);
          adapter.setState('info.FWrelD', JSON.parse(resdata)[801][102], true);
          var sdinfo = JSON.parse(resdata)[895];
          adapter.setState('info.SD', '[' + sdinfo[101] + '|' + sdinfo[103] + '|' + sdinfo[102] + '|' + sdinfo[100] + '] - ' + sdinfo[104] + '/' + sdinfo[105], true);

        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in system information: " + e);
          throw e
        }

        try { //"152":null,"161":null,"162":null

          var effizienz = JSON.parse(resdata)[162];
          var leistung = JSON.parse(resdata)[161];
          var setpointY = effizienz * (leistung / 1000);

          adapter.setState('forecast.setpointYear', setpointY, true);

          adapter.setState('forecast.setpointMonth.01', (JSON.parse(resdata)[152][0] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.02', (JSON.parse(resdata)[152][1] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.03', (JSON.parse(resdata)[152][2] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.04', (JSON.parse(resdata)[152][3] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.05', (JSON.parse(resdata)[152][4] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.06', (JSON.parse(resdata)[152][5] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.07', (JSON.parse(resdata)[152][6] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.08', (JSON.parse(resdata)[152][7] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.09', (JSON.parse(resdata)[152][8] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.10', (JSON.parse(resdata)[152][9] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.11', (JSON.parse(resdata)[152][10] / 100) * setpointY, true);
          adapter.setState('forecast.setpointMonth.12', (JSON.parse(resdata)[152][11] / 100) * setpointY, true);

          var ds = new Date();
          var m = ds.getMonth();
          adapter.setState('forecast.setpointCurrMonth', ((JSON.parse(resdata)[152][m] / 100) * setpointY), true);
          adapter.setState('forecast.setpointToday', ((JSON.parse(resdata)[152][m] / 100) * setpointY) / 30, true);


        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in setpoint: " + e);
          throw e
        }



        try { //"858":null
          battdata = JSON.parse(resdata)[858];
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
          adapter.log.warn("JSON-parse-Fehler Battpresent: " + e.message);
          throw e
        }
        if (names.length > 0 && deviceclasses.length > 0) {
          setInvObjects();
        }
        break;

      case '{"447"': //pollingData = '{"447":null,"777":{"0":null},"778":{"0":null},"801":{"170":null}}';


        try { //"447":null
          var dataSG = (JSON.parse(resdata)[447]);
          adapter.log.debug("Schaltgruppen: " + namessg.filter(function() {
            return true
          }));
          adapter.log.debug("Anzahl Elemente: " + numsg);
          for (var sgj = 0; sgj < 10; sgj++) {
            if (namessg[sgj] != "") {
              adapter.log.debug("SwichtGroup." + namessg[sgj] + " Modus: " + dataSG[sgj][102]);
              adapter.setState("SwitchGroup." + namessg[sgj] + ".mode", dataSG[sgj][102], true);
              adapter.log.debug("SwichtGroup." + namessg[sgj] + " Verknüpfte Hardware: " + names[dataSG[sgj][101][0][100]]);
              adapter.setState("SwitchGroup." + namessg[sgj] + ".linkeddev", names[dataSG[sgj][101][0][100]], true);
              adapter.log.debug("SwichtGroup." + namessg[sgj] + " Verknüpfte Hardware Untereinheit: " + dataSG[sgj][101][0][101]);
              adapter.setState("SwitchGroup." + namessg[sgj] + ".linkeddevsub", dataSG[sgj][101][0][101], true);
            }
          }
        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in swichtgroupmode: " + e);
          throw e
        }

        try { //"801":{"170":null}
          json = (JSON.parse(resdata)[801][170]);
          adapter.log.debug("Data801_170: " + json);
          adapter.setState('info.lastSync', json[100], true);
          adapter.setState('info.totalPower', json[116], true);
          adapter.setState('status.pac', json[101], true);
          adapter.setState('status.pdc', json[102], true);
          adapter.setState('status.uac', json[103], true);
          adapter.setState('status.udc', json[104], true);
          adapter.setState('status.conspac', json[110], true);
          adapter.setState('status.yieldday', json[105], true);
          adapter.setState('status.yieldyesterday', json[106], true);
          adapter.setState('status.yieldmonth', json[107], true);
          adapter.setState('status.yieldyear', json[108], true);
          adapter.setState('status.yieldtotal', json[109], true);
          adapter.setState('status.consyieldday', json[111], true);
          adapter.setState('status.consyieldyesterday', json[112], true);
          adapter.setState('status.consyieldmonth', json[113], true);
          adapter.setState('status.consyieldyear', json[114], true);
          adapter.setState('status.consyieldtotal', json[115], true);
        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in standard data request: " + e);
          throw e;
        }

        try { //"777":{"0":null}
          var dataSUZ = JSON.parse(resdata)[777][0];
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
        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in sum data inverters: " + e);
          throw e
        }

        try { ////"778":{"0":null}
          var dataselfcons = JSON.parse(resdata)[778][0];
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
          var dayratio = Math.round((daysum / json[105]) * 1000) / 10;


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
            var dayratioy = Math.round((daysumy / json[106]) * 1000) / 10;

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
        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in self consumtion: " + e);
          throw e
        }

        break;

      case '{"608"': //fastpollData = '{"608":null,"780":null,"781":null,"782":null,"801":{"175":null},"858":null}';
        try { //"608":null
          var datafast = (JSON.parse(resdata));
          adapter.log.debug("Inv. to treat: " + names);
          var namLeng = names.length;
          adapter.log.debug("Anzahl Elemente: " + namLeng);
          for (var uzj = 0; uzj < namLeng; uzj++) {
            if (deviceclasses[uzj] != "Batterie") {
              adapter.log.debug("INV." + names[uzj] + " Status: " + datafast[608][uzj]);
              adapter.setState("INV." + names[uzj] + ".status", datafast[608][uzj], true);
              adapter.log.debug("INV." + names[uzj] + " PAC: " + datafast[782][uzj]);
              adapter.setState("INV." + names[uzj] + ".PAC", datafast[782][uzj], true);
            }
          }


          adapter.log.debug("Schaltgruppen: " + namessg.filter(function() {
            return true
          }));
          adapter.log.debug("Anzahl Schaltgruppen: " + numsg);
          for (var sgsj = 0; sgsj < 10; sgsj++) {
            if (namessg[sgsj] != "") {
              adapter.log.debug("SwichtGroup." + namessg[sgsj] + " Status: " + datafast[801][175][sgsj][101]);
              adapter.setState("SwitchGroup." + namessg[sgsj] + ".state", datafast[801][175][sgsj][101], true);
            }
          }

          battdata = datafast[858];
          adapter.log.debug("Battdata: " + battdata);
          adapter.log.debug("Battdata - Länge: " + battdata.length)
          if (battdata.length == 0) {
            battdata[2] = 0;
            battdata[3] = 0;
          }
          adapter.log.debug("Erzeugung: " + (+datafast[780] - +battdata[3]));
          adapter.setState('status.pac', (+datafast[780] - +battdata[3]), true);
          adapter.log.debug("Verbrauch: " + (+datafast[781] - +battdata[2]));
          adapter.setState('status.conspac', (+datafast[781] - +battdata[2]), true);

          if (battdevicepresent == "true" && battpresent == "true") {
            adapter.setState("INV." + names[battindex[0]] + '.BattLevel', battdata[1], true);
            adapter.setState("INV." + names[battindex[0]] + '.ChargePower', battdata[2], true);
            adapter.setState("INV." + names[battindex[0]] + '.DischargePower', battdata[3], true);
            feed = (+datafast[780] - +datafast[781]);
            adapter.log.debug("Erzeugung(+)/Verbrauch(-): " + feed);
            adapter.setState('status.feed', feed, true);
            if (Math.sign(feed) == 1) {
              adapter.setState('status.feedin', feed, true);
              adapter.setState('status.feedinactive', true, true);
              adapter.setState('status.feedout', 0, true);
            } else {
              adapter.setState('status.feedin', 0, true);
              adapter.setState('status.feedinactive', false, true);
              adapter.setState('status.feedout', Math.abs(feed), true);
            }
          } else if (battdevicepresent == "false" && battpresent == "true") {
            adapter.setState('INV.Battery.BattLevel', battdata[1], true);
            adapter.setState('INV.Battery.ChargePower', battdata[2], true);
            adapter.setState('INV.Battery.DischargePower', battdata[3], true);
            feed = (+datafast[780] - +datafast[781]);
            adapter.log.debug("Erzeugung(+)/Verbrauch(-): " + feed);
            adapter.setState('status.feed', feed, true);
            if (Math.sign(feed) == 1) {
              adapter.setState('status.feedin', feed, true);
              adapter.setState('status.feedinactive', true, true);
              adapter.setState('status.feedout', 0, true);
            } else {
              adapter.setState('status.feedin', 0, true);
              adapter.setState('status.feedinactive', false, true);
              adapter.setState('status.feedout', Math.abs(feed), true);
            }
          } else if (battdevicepresent == "false" && battpresent == "false") {
            adapter.log.debug("Keine Batterie vorhanden");
            feed = (+datafast[780] - +datafast[781]);
            adapter.log.debug("Erzeugung(+)/Verbrauch(-): " + feed);
            adapter.setState('status.feed', feed, true);
            if (Math.sign(feed) == 1) {
              adapter.setState('status.feedin', feed, true);
              adapter.setState('status.feedinactive', true, true);
              adapter.setState('status.feedout', 0, true);
            } else {
              adapter.setState('status.feedin', 0, true);
              adapter.setState('status.feedinactive', false, true);
              adapter.setState('status.feedout', Math.abs(feed), true);
            }
          } else {
            adapter.log.debug("Strange: Batteriedaten vorhanden aber Batterie - Vorhanden Indikatoren falsch")
          }

          setdisplaydata(datafast[794][0]);

        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in datafast: " + e);
          throw e
        }
        break;

      case '{"854"': //var historicData = '{"854":null,"877":null,"878":null}';

        try { //"854":null
          var dataYear = JSON.parse(resdata)[854];
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
        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in status data inverters: " + e);
          throw e
        }

        try { //"877":null
          var dataMonthtot = JSON.parse(resdata)[877];
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

        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in historic monthly: " + e);
          throw e
        }

        try { //878":null}
          var dataYeartot = JSON.parse(resdata)[878];
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


        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in status historic sum data: " + e);
          throw e
        }
        break;

      case '{"801"': //nur Daten über offene JSON-Schnittstelle'
        try {
          json = (JSON.parse(resdata)[801][170]);
          adapter.log.debug("Data open JSON: " + json);
          adapter.setState('info.lastSync', json[100], true);
          adapter.setState('info.totalPower', json[116], true);
          adapter.setState('status.pac', json[101], true);
          adapter.setState('status.pdc', json[102], true);
          adapter.setState('status.uac', json[103], true);
          adapter.setState('status.udc', json[104], true);
          adapter.setState('status.conspac', json[110], true);
          adapter.setState('status.yieldday', json[105], true);
          adapter.setState('status.yieldyesterday', json[106], true);
          adapter.setState('status.yieldmonth', json[107], true);
          adapter.setState('status.yieldyear', json[108], true);
          adapter.setState('status.yieldtotal', json[109], true);
          adapter.setState('status.consyieldday', json[111], true);
          adapter.setState('status.consyieldyesterday', json[112], true);
          adapter.setState('status.consyieldmonth', json[113], true);
          adapter.setState('status.consyieldyear', json[114], true);
          adapter.setState('status.consyieldtotal', json[115], true);


        } catch (e) {
          adapter.log.warn("readSolarlogData - Fehler in standard data request: " + e);
          throw e;
        }
        break;

      default:
        adapter.log.warn("Fehler: Problem bei der Solarlog-Datenauswertung, kein Datensatz erkannt");
    }

  } catch (e) {
    adapter.log.warn("readSolarlogData - Fehler : " + e);
  }
} //end readSolarlogData

function defdeviceinfo() { //Geräteinfos httpsReqGetUzDeviceinfo
  var namLeng = names.length;
  for (var y = 0; y < namLeng; y++) {
    adapter.log.debug("INV." + names[y] + ".devicetype: " + devicelist[deviceinfos[y]][1]);
    devicetypes.push(devicelist[deviceinfos[y]][1]);

    adapter.log.debug("INV." + names[y] + ".devicebrand: " + brandlist[devicelist[deviceinfos[y]][0]]);
    devicebrands.push(brandlist[devicelist[deviceinfos[y]][0]]);

    deviceclasses.push(deviceclasslist[(Math.log(devicelist[deviceinfos[y]][5]) / Math.LN2)]);
    if (deviceclasslist[(Math.log(devicelist[deviceinfos[y]][5]) / Math.LN2)] == "Batterie") {
      battdevicepresent = "true";
      adapter.log.debug("Batterie als Gerät vorhanden");
      battindex[battarrind] = y;
      adapter.log.debug("Index Gerät Batterie: " + y);
      battarrind++;

      adapter.log.debug("INV." + names[y] + ".deviceclass: " + deviceclasslist[(Math.log(devicelist[deviceinfos[y]][5]) / Math.LN2)]);

    }
    adapter.log.debug("Batterie als Gerät: " + battdevicepresent);
  }
  adapter.log.debug("Devicetypes: " + devicetypes);
  adapter.log.debug("Devicebrands: " + devicebrands);
  adapter.log.debug("Deviceclasses: " + deviceclasses);

  if (names.length > 0 && deviceclasses.length > 0) {
    setInvObjects();
  }

} // end defdeviceinfo

function setInvObjects() {
  // create Channel Inverter(i)
  adapter.log.debug("Lege nun Objekte an - soweit nicht vorhanden 2");
  adapter.log.debug("NumInv Obj: " + numinv);
  adapter.log.debug("Names zum anlegen: " + names);
  adapter.log.debug("Anzahl Schaltgruppen: " + numsg);
  adapter.log.debug("Schaltgruppen: " + namessg);
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

  if (numsg > 0) {
    for (var jsg = 0; jsg < 10; jsg++) {
      if (namessg[jsg] != "") {
        adapter.setObjectNotExists("SwitchGroup." + namessg[jsg] + ".mode", {
          type: 'state',
          common: {
            name: 'swichtgroupmode',
            desc: 'shows set mode on/auto/off',
            type: 'number',
            states: {
              0: "OFF",
              1: "ON",
              2: "AUTO"
            },
            role: "value.switchgroupmode",
            read: true,
            write: false
          },
          native: {}
        });

        adapter.setObjectNotExists("SwitchGroup." + namessg[jsg] + ".state", {
          type: 'state',
          common: {
            name: 'swichtgroupstate',
            desc: 'shows set mode on/auto/off',
            type: 'number',
            states: {
              0: "OFF",
              240: "Switching",
              255: "ON"
            },
            role: "value.switchgroupstate",
            read: true,
            write: false
          },
          native: {}
        });

        adapter.setObjectNotExists("SwitchGroup." + namessg[jsg] + ".linkeddev", {
          type: 'state',
          common: {
            name: 'swichtgrouplinkeddev',
            desc: 'Hardware linked to SwitchGroup',
            type: 'string',

            role: "value.switchgrouplinkeddev",
            read: true,
            write: false
          },
          native: {}
        });

        adapter.setObjectNotExists("SwitchGroup." + namessg[jsg] + ".linkeddevsub", {
          type: 'state',
          common: {
            name: 'swichtgrouplinkeddevsub',
            desc: 'Sub-device of hardware linked to SwitchGroup (if existing)',
            type: 'number',

            role: "value.switchgrouplinkeddevsub",
            read: true,
            write: false
          },
          native: {}
        })

      }
    }
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
      name: 'selfconsyear',
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
  adapter.setObjectNotExists('info.RTOS', {
    type: 'state',
    common: {
      name: 'RTOS',
      desc: 'RTOS',
      type: 'string',
      role: "value.RTOS",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.CLIB', {
    type: 'state',
    common: {
      name: 'CLIB',
      desc: 'CLIB',
      type: 'string',
      role: "value.CLIB",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.MAC', {
    type: 'state',
    common: {
      name: 'MAC-Adress',
      desc: 'MAC-Adress',
      type: 'string',
      role: "value.MAC",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.SN', {
    type: 'state',
    common: {
      name: 'Serial Number',
      desc: 'Serial Number',
      type: 'string',
      role: "value.SN",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.Model', {
    type: 'state',
    common: {
      name: 'Model - Number',
      desc: 'Model - Number (SolarLog XX)',
      type: 'string',
      role: "value.Model",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.InstDate', {
    type: 'state',
    common: {
      name: 'Installation - date',
      desc: 'Installation - date',
      type: 'string',
      role: "value.InstDate",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.FW', {
    type: 'state',
    common: {
      name: 'Firmware version',
      desc: 'Firmware version',
      type: 'string',
      role: "value.FW",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.FWrelD', {
    type: 'state',
    common: {
      name: 'Firmware realease date',
      desc: 'Firmware realease date',
      type: 'string',
      role: "value.FWrelD",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('info.SD', {
    type: 'state',
    common: {
      name: 'SC card info',
      desc: 'SC card info',
      type: 'string',
      role: "value.SD",
      read: true,
      write: false
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointToday', {
    type: 'state',
    common: {
      name: 'setpointToday',
      desc: 'todays production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.01', {
    type: 'state',
    common: {
      name: 'setpointJAN',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.02', {
    type: 'state',
    common: {
      name: 'setpointFEB',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.03', {
    type: 'state',
    common: {
      name: 'setpointMAR',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.04', {
    type: 'state',
    common: {
      name: 'setpointAPR',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.05', {
    type: 'state',
    common: {
      name: 'setpointMAY',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.06', {
    type: 'state',
    common: {
      name: 'setpointJUN',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.07', {
    type: 'state',
    common: {
      name: 'setpointJUL',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.08', {
    type: 'state',
    common: {
      name: 'setpointAUG',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.09', {
    type: 'state',
    common: {
      name: 'setpointSEP',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.10', {
    type: 'state',
    common: {
      name: 'setpointOCT',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.11', {
    type: 'state',
    common: {
      name: 'setpointNOV',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointMonth.12', {
    type: 'state',
    common: {
      name: 'setpointDEC',
      desc: 'monthly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointYear', {
    type: 'state',
    common: {
      name: 'setpoint current year',
      desc: 'yearly production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
    },
    native: {}
  });
  adapter.setObjectNotExists('forecast.setpointCurrMonth', {
    type: 'state',
    common: {
      name: 'setpoint current month',
      desc: 'monthly (current) production estimation',
      type: 'number',
      role: "value.setpoint",
      read: true,
      write: false,
      unit: "kWh"
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
  if (forecast == "true") {
    setforecastobjects();
  } else {
    logcheck(pollingData);
  }
} //End setdeviceinfo

function setforecastobjects() {
  adapter.log.debug("Lege Objekt für Forecast an");
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
    if (uzimp == "true") {
      logcheck(pollingData);
    } else {
      logcheck(['{"801":{"170":null}}']);
    }
  }, 1000);
} //end setforecastobjects()

function getforecastdata() {
  adapter.log.debug("Rufe Forcastdaten ab");
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

function setdisplaydata(displaydata) {
  var checkok = [];
  for (var di = 0; di <= 15; di++) {
    checkok[di] = displaydata[di][1];
  }

  function checkerr(errval) {
    return errval == 0;
  }
  adapter.log.debug("Display OK?: " + checkok.every(checkerr));
  adapter.setState('display.OK', checkok.every(checkerr), true);

  adapter.log.debug("Display Icon Inverter: " + displaydata[0][0]);
  adapter.setState('display.invicon', displaydata[0][0], true);
  adapter.log.debug("Display Icon Network: " + displaydata[1][0]);
  adapter.setState('display.networkicon', displaydata[1][0], true);
  adapter.log.debug("Display Icon Meter: " + displaydata[6][0]);
  adapter.setState('display.metericon', displaydata[6][0], true);
  adapter.log.debug("Display Icon Mail: " + displaydata[11][0]);
  adapter.setState('display.mailicon', displaydata[11][0], true);
  adapter.log.debug("Display Inverter Error: " + displaydata[0][1]);
  adapter.setState('display.inverror', displaydata[0][1], true);
  adapter.log.debug("Display Network Error: " + displaydata[1][1]);
  adapter.setState('display.networkerror', displaydata[1][1], true);
  adapter.log.debug("Display Meters offline: " + displaydata[6][1]);
  adapter.setState('display.metersoffline', displaydata[6][1], true);
  adapter.log.debug("Display Mail Error: " + displaydata[11][1]);
  adapter.setState('display.mailerror', displaydata[11][1], true);

} //end setdisplaydata

function restartAdapter() {
  adapter.getForeignObject('system.adapter.' + adapter.namespace, (err, obj) => {
    if (obj) adapter.setForeignObject('system.adapter.' + adapter.namespace, obj);
  });
} // endFunctionRestartAdapter

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
  module.exports = startAdapter;
} else {
  // or start the instance directly
  startAdapter();
} // endElse
