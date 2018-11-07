/**
 * solarlog adapter
 */

/* jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const utils = require(__dirname + '/lib/utils'); // Get common adapter utils
const adapter = new utils.Adapter('solarlog');
var https = require('http'); 

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
    adapter.log.info('stateChange ' + id + ' ' + JSON.stringify(state));

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
            console.log('send command');

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
    const DeviceIpAdress = adapter.config.host;
    const cmd = "/getjp"; // Kommandos in der URL nach der Host-Adresse
    const data = '{"801":{"170":null}}';

    const options = {
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

   httpsReq(cmd, data, options);

    if (!polling) {
        polling = setInterval(() => { // poll states every [30] seconds
            httpsReq(cmd, data, options);
        }, pollingTime);
    } // endIf
	
    // all states changes inside the adapters namespace are subscribed
    adapter.subscribeStates('*');

    adapter.getForeignObject(adapter.namespace, (err, obj) => { // create device namespace
        if (!obj) {
            adapter.setForeignObject(adapter.namespace, {
                type: 'device',
                common: {
                    name: 'solarlog device'
                }
            });
        } // endIf
   });
} // endMain	
	



function httpsReq(cmd, data, options) { 
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
//        if(logOn) log("ARRAY mit den einzelnen Zeilen: " + bodyChunks);
//        if(logOn) log("ARRAY Länge: " + bodyChunks.length);
        var body = Buffer.concat(bodyChunks);
        // ...und/oder das Gesamtergebnis (body).
        
                var json = (JSON.parse(body));
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
        });

    });
    
    req.on('error', function(e) { // Fehler abfangen
        console.log('ERROR: ' + e.message,"warn");
    });

    console.log("Data to request body: " + data);
    // write data to request body
    (data ? req.write(data) : console.log("Daten: keine Daten im Body angegeben angegeben"));
    req.end();

} //end httpsReq()
