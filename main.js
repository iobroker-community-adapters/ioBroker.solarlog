/**
 * solarlog adapter
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = new utils.Adapter('solarlog');
var DeviceIpAdress;
var https = require('http'); 
const cmd = "/getjp"; // Kommandos in der URL nach der Host-Adresse
var statusuz ="on";
var numinv = 0;
var names =[];
var uzimp = "false";
var testend;
var testj= 0;
var testi= 0;



let polling;


// when adapter shuts down
adapter.on('unload', function (callback) {
    try {
        clearInterval(polling);
        adapter.log.info('[END] Stopping solarlog adapter...');
        adapter.setState('info.connection', false, true);
        callback();
    } catch (e) {
        callback();
    }
});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    // Warning, obj can be null if it was deleted
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
}); 

// is called if a subscribed state changes
adapter.on('stateChange', function (id, state) {
    // Warning, state can be null if it was deleted
    adapter.log.debug('stateChange ' + id + ' ' + JSON.stringify(state));

    // you can use the ack flag to detect if it is status (true) or command (false)
    if (state && !state.ack) {
        adapter.log.info('ack is not set!');
    }
});

// Some message was sent to adapter instance over message box. Used by email, pushover, text2speech, ...
adapter.on('message', function (obj) {
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
        main();
    } else adapter.log.warn('[START] No IP-address set');
});


function main() {
    // Vars
    DeviceIpAdress = adapter.config.host;
    const cmd = "/getjp"; // Kommandos in der URL nach der Host-Adresse
    var statusuz ="on";
	var numinv = 0;
	var uzimp = (adapter.config.invimp).toString();
	adapter.log.debug("InvImp: " + adapter.config.invimp);
	adapter.log.debug("uzimp: " + uzimp);
	var data='{"608":null}';
	var options = {
		host: DeviceIpAdress,
		path: cmd,
		method: 'POST',
		headers: {
			'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
			'Content-Type': 'application/json',
			'Accept': 'applciation/json',
			'Content-Length': data.length
		}
	};   
    const pollingTime = adapter.config.pollInterval || 300000;
    adapter.log.debug('[INFO] Configured polling interval: ' + pollingTime);
    adapter.log.debug('[START] Started Adapter with: ' + adapter.config.host);
	
	adapter.log.debug("Options: " + JSON.stringify(options));
	adapter.log.debug("Data: " + JSON.stringify(data));
	
	if (uzimp == "true"){
		adapter.log.debug("uzimp: " + uzimp);
		adapter.log.debug("WR Importieren");
    	
		httpsReqNumInv(data, options, numinv, uzimp, defobjUZ()); //Anlegen eines Channels pro Unterzähler mit den Objekten Wert und Status
		
		testend = setInterval(test, 2000); //überprüfen ob alle Channels angelegt sind. 
    	
		setTimeout(function(){httpsReqDataStandard(cmd, uzimp);},300000); //abfragen der Standard-Werte
	
		
		if (!polling) {
			polling = setTimeout(function repeat() { // poll states every [30] seconds
				httpsReqDataStandard(cmd, uzimp, httpsReqDataUZ(cmd, names));
				setTimeout(repeat, pollingTime);
			}, pollingTime);
		} // endIf

		}
	else{
		adapter.log.debug("uzimp: " + uzimp);
		adapter.log.debug("WR nicht Importieren");
		httpsReqDataStandard(cmd, uzimp);
			
		if (!polling) {
			polling = setTimeout(function repeat() { // poll states every [30] seconds
			
				httpsReqDataStandard(cmd, uzimp);
			
				setTimeout(repeat, pollingTime);
			}, pollingTime);
		} // endIf
	}
    // all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

   
} // endMain	

function test() {
	adapter.getState("info.numinv", function (err, obj) {
		if (obj){
        numinv = obj.val;
		adapter.log.debug("Inverters to test: " + names);
		adapter.log.debug("numinv: " + numinv);
		names.forEach(check);
		adapter.log.debug("Anzahl positiv: " + testi);
			if (testi==numinv){
				adapter.log.info("Alle WR/Meter gefunden");
				adapter.log.debug("Names: " + names);
				httpsReqDataUZ(cmd, names);
				clearInterval(testend);	
				}
			else {
			testi=0;
			adapter.log.warn("Nicht alle WR/Meter gefunden");
			testj++;
			  if (testj>3){
				adapter.log.warn("Fehler, noch nicht alle Unterzähler angelegt");
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
		}
        else{adapter.log.warn("Adapter " + uz + " nicht vorhanden");
        }
	});
} // END check()

function httpsReqNumInv(data, options, numinv) { //Ermittelt die Anzahl Unterzähler und löst das Anlegen der Channels/Objekte aus.
	var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (RÃ¼ckmeldung vom Webserver)
    var bodyChunks  = [];
    var chunkLine   = 0;
    res.on('data', function(chunk) {
        chunkLine = chunkLine + 1;
        // Hier kÃ¶nnen die einzelnen Zeilen verarbeitet werden...
        bodyChunks.push(chunk);

    }).on('end', function() {
        var body = Buffer.concat(bodyChunks);
        // ...und/oder das Gesamtergebnis (body).
        adapter.log.debug("body: " + body);
		try{
			var dataJ=JSON.parse(body);
			
			if (adapter.config.numinv = 0) {			
				while (statusuz != "OFFLINE" && numinv < 100) {
					statusuz = (dataJ[608][numinv.toString()]);  
						if (statusuz != "OFFLINE") {
						   adapter.log.debug(dataJ[608][numinv.toString()]);
						}
					numinv++;
					}
			}
			else {
				numinv = adapter.config.numinv + 1;
				adapter.log.debug("Manuell " + numinv-1 + " Zaehler importieren");
				}
			
		} catch(e) {
				adapter.log.warn("JSON-parse-Fehler NumInv: " + e.message);
		}			
        adapter.setState('info.numinv'/*numinv*/, numinv-1, true);
        adapter.log.debug("Numer of Inverters/Meters :" + numinv-1);
		adapter.log.debug("END Request: " + JSON.stringify(data));
		
		adapter.setObjectNotExists('INV', {
        type: 'device',
        role: '',
        common: {
            name: "Inverter"
        },
        native: {}
		});
          
        defobjUZ(numinv); 
		});   
	}); 
 req.on('error', function(e) { // Fehler abfangen
        adapter.log.warn('ERROR ReqNumInv: ' + e.message,"warn");
        });

    adapter.log.debug("Data to request body: " + data);
    // write data to request body
    (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
 req.end();              
  
} //end httpsReqNumInv

function defobjUZ(numinv){ //Schlaufe mit Abfrage der Information pro Unterzähler und auslösen der Objekterstellung
    for (var i=0; i<numinv-1;i++) {
		var data1 = '{"141":{"';
		var data2 = '":{"119":null}}}';
		var datauz = data1 + i.toString() + data2;
		var options = {
			host: DeviceIpAdress,
			path: cmd,
			method: 'POST',
			headers: {
					'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
					'Content-Type': 'application/json',
					'Accept': 'applciation/json',
					'Content-Length': datauz.length
					}
			};
			
		adapter.log.debug("Options: " + JSON.stringify(options));
		adapter.log.debug("Data: " + JSON.stringify(datauz));
		
		httpsReqSetUZ(datauz, options, i);
    }  
} //end defobjUZ

function httpsReqSetUZ(data, options, i) { //erstellt die Channels und Objekte pro Unterzähler
    var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
	var bodyChunks  = [];
    var chunkLine   = 0;
    res.on('data', function(chunk) {
        chunkLine = chunkLine + 1;
        // Hier können die einzelnen Zeilen verarbeitet werden...
        bodyChunks.push(chunk);

    }).on('end', function() {
        var bodyuz = Buffer.concat(bodyChunks);
        // ...und/oder das Gesamtergebnis (body).
        adapter.log.debug("body: " + bodyuz);
        
		try{
		var dataJuz = (JSON.parse(bodyuz));
			
		// create Channel Inverter(i)
		adapter.setObjectNotExists('INV.' + (dataJuz[141][i.toString()][119]).toString(), {
			type: 'channel',
			role: '',
			common: {
				name: "" + (dataJuz[141][i.toString()][119]).toString()
			},
			native: {}
		});
		
		// create States PAC/Status Inverter(i)
		adapter.setObjectNotExists('INV.' + (dataJuz[141][i.toString()][119]).toString() + ".PAC",{
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
		
		adapter.setObjectNotExists('INV.' + (dataJuz[141][i.toString()][119]) + ".status",{
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
  			
		names.push(dataJuz[141][i.toString()][119]);
		adapter.log.debug("Inverters: " + names);
		
		} catch(e) {
				adapter.log.warn("JSON-parse-Fehler SetUZ: " + e.message);
		}
		});

    });
    
 req.on('error', function(e) { // Fehler abfangen
        adapter.log.warn('ERROR ReqSetUZ: ' + e.message,"warn");
    });

    adapter.log.debug("Data to request body: " + data);
    // write data to request body
    (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
        
req.end();
} //End httpsReqSetUZ


function httpsReqDataStandard(cmd) { //Abfrage der Standardwerte
	var data = '{"801":{"170":null}}';
	var options = {
		host: DeviceIpAdress,
		path: cmd,
		method: 'POST',
		headers: {
			'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
			'Content-Type': 'application/json',
			'Accept': 'applciation/json',
			'Content-Length': data.length
		}
	};   
	var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
    var bodyChunks  = [];
    var chunkLine   = 0;
    res.on('data', function(chunk) {
        chunkLine = chunkLine + 1;
        // Hier können die einzelnen Zeilen verarbeitet werden...
        bodyChunks.push(chunk);
    }).on('end', function() {
		adapter.log.debug("no more date in response");
   	
        var body = Buffer.concat(bodyChunks);
        // ...und/oder das Gesamtergebnis (body).
        
			try{
                var json = (JSON.parse(body));
				adapter.log.debug("Body: " + body);
				adapter.setState('info.lastSync', json[801][170][100] , true);
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
			} catch(e) {
				adapter.log.warn("JSON-parse-Fehler DataStandard: " + e.message);
			}
			if (uzimp=="true"){
				httpsReqDataUZ(cmd, names, httpsReqStatUZ(cmd, names));
			}
			
	       });
	});
	
   
    req.on('error', function(e) { // Fehler abfangen
        adapter.log.warn('ERROR ReqDataStandard: ' + e.message,"warn");
    });

    adapter.log.debug("Data to request body: " + data);
    // write data to request body
    (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
    req.end();

} //end httpsReqDataStandard()

function httpsReqDataUZ(cmd, names){ //Abfrage der Unterzählerwerte
    var data = '{"782":null}';
    var options = {
    host: DeviceIpAdress,
    path: cmd,
    method: 'POST',
    headers: {
        'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'applciation/json',
        'Content-Length': data.length
        }
    };   
    
    var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
    var bodyChunks  = [];
    var chunkLine   = 0;
    res.on('data', function(chunk) {
        chunkLine = chunkLine + 1;
        // Hier können die einzelnen Zeilen verarbeitet werden...
        bodyChunks.push(chunk);

    }).on('end', function() {
        var body = Buffer.concat(bodyChunks);
        // ...und/oder das Gesamtergebnis (body).
        adapter.log.debug("body: " + body);
		
		try{		
		var dataJUZ = (JSON.parse(body));
		adapter.log.debug("Inv. to treat: " + names);
		var namLeng = names.length;
		adapter.log.debug("Anzahl Elemente: " + namLeng);
		for (var uzi=0; uzi<namLeng; uzi++){
			adapter.log.debug("INV." + names[uzi] + ": " + dataJUZ[782][uzi]);
			adapter.setState("INV." + names[uzi] + ".PAC", dataJUZ[782][uzi], true);
		}
		adapter.log.debug("END");
		
		} catch(e) {
				adapter.log.warn("JSON-parse-Fehler DataUZ: " + e.message);
		}
		httpsReqStatUZ(cmd, names);
     
        });

    });
    
    req.on('error', function(e) { // Fehler abfangen
        adapter.log.warn('ERROR ReqDataUZ: ' + e.message,"warn");
    });

    adapter.log.debug("Data to request body: " + data);
    // write data to request body
    (data ? req.write(data) : adapter.log.warn("Daten: keine Daten im Body angegeben angegeben"));
     
    req.end();	
} //End httpsReqDataUZ

function httpsReqStatUZ(cmd, names){ //Abfrage der Unterzählerwerte
    var data = '{"608":null}';
    var options = {
    host: DeviceIpAdress,
    path: cmd,
    method: 'POST',
    headers: {
        'User-Agent' : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/57.0.2987.133 Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'applciation/json',
        'Content-Length': data.length
        }
    };   
    
    var req = https.request(options, function(res) {
    adapter.log.debug("http Status: " + res.statusCode);
    adapter.log.debug('HEADERS: ' + JSON.stringify(res.headers), (res.statusCode != 200 ? "warn" : "info")); // Header (Rückmeldung vom Webserver)
    var bodyChunks  = [];
    var chunkLine   = 0;
    res.on('data', function(chunk) {
        chunkLine = chunkLine + 1;
        // Hier können die einzelnen Zeilen verarbeitet werden...
        bodyChunks.push(chunk);

    }).on('end', function() {
        var body = Buffer.concat(bodyChunks);
        // ...und/oder das Gesamtergebnis (body).
        adapter.log.debug("body: " + body);
			try{
			var dataJSUZ = (JSON.parse(body));
			adapter.log.debug("Inv. to treat: " + names);
			var namLeng = names.length;
			adapter.log.debug("Anzahl Elemente: " + namLeng);
			for (var uzj=0; uzj<namLeng; uzj++){
				adapter.log.debug("INV." + names[uzj] + ": " + dataJSUZ[608][uzj]);
				adapter.setState("INV." + names[uzj] + ".status", dataJSUZ[608][uzj], true);
			}
            adapter.log.debug("END");
      
			} catch(e) {
				adapter.log.warn("JSON-parse-Fehler StatUZ: " + e.message);
		}
        });

    });
    
    req.on('error', function(e) { // Fehler abfangen
        adapter.log.debug('ERROR ReqStatUZ: ' + e.message,"warn");
    });

    adapter.log.debug("Data to request body: " + data);
    // write data to request body
    (data ? req.write(data) : adapter.log.debug("Daten: keine Daten im Body angegeben angegeben"));
     
    req.end();	
} //End httpsReqStatUZ
