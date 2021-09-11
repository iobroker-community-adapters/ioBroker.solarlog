# Solarlog data objects

## Offical JSON-request

-   {"801":{"170":null}} Result see user manual

## OTHERS

All these requests have been discovered by analyzing the solarlog webinterface with developer - tools.

### Device data (inverters/meters/batteries/other)

-   {"740":null} Serial numbers of connected devices (if it's not "Err", you know there is a device on this position).

-   {"141":{"i":{"119":null}}} Name of inverter. i = Position in the objekt "740", above. !! Do not call the entire
    "141" - object, it lasts very long or your solarlog can't handle that.

-   {"141":{"i":{"162":null}}} Device specification. i = Position in the objekt "740", above. !! Do not call the
    entire "141" - object, it lasts very long or your solarlog can't handle that.

-   {"739":null} list of all possible devices. Specifications for every device such as brandcode (brands found
    in "744"), name[1], deviceclasscode (deviceclass: 1:Wechselrichter, 2:Sensor, 4:Schalter, 8: Hybrid-System, 16: Batterie, 32: Intelligente Verbraucher, 64: Schalter, 128: Wärmepumpe, 256: Heizstab, 512: Ladestation).

-   {"744":null} list of all brands / brandcodes

-   {"782":null} consumption/Production per inverter/meter.
-   {"608":null} Status per inverter/meter.

-   {"771"::null} daily sum of total production & consumption ["timestamp(day/noon)","Wh production", "Wh consumption"].
-   {"776"::null} 5-min consumption/production per inverter/meter.
-   {"777"::null} daily consumption/production per inverter/meter.
-   {"778"::null} daily self - consumption; self-consuption, charge & discharge energy of battery if connected.
-   {"779"::null} monthly consumption/production per inverter/meter.
-   {"854":null} yealry consumption/production per inverter/meter.
-   {"858":null} voltage, level, charge & discharge power of battery. Empty if no battery is connected.
-   {"867":null} 5-min (current day, every 5 min) values for total production, total consumption, current production,  
    current consumption.
-   {"877":null} monthly values for production (Wh), consuption (Wh) and self-consumption (kWh).
-   {"878":null} yearly values for production (Wh), consuption (Wh) and self-consumption (kWh).

### Smart energy data

-   {"447":null} defined switching groups (Schaltgruppen): 100: name, 101: linked hardware, 102: mode (on/off/auto),
-   {"801":{"175":null}} state of switch in group (on/off)

### Other data

-   {"152":null} 0-11: monthly % of total production estimated,
-   {"161":null} Wp installed,
-   {"162":null} kWh/kWp p.a. estimated,
-   {"141":{"i":{"708/709/710"}}} list of events per device: 708: list of possible events, 709: error codes,
        710: 100 last events (timestamps start, end, 0, eventcode, errorcode),
-   {"780":null} Total energy input (production + battery discharge power),
-   {"781":null} Total energy output (consumption + battery charge power).    

### System information

-   {"610":null} RTOS,
-   {"611":null} CLIB,
-   {"617":null} MAC - address,
-   {"706":null} Serial number,
-   {"800":{"100":null}} Model (Number),
-   {"800":{"160":null}} Installation Date,
-   {"801":{"101":null}} Firmware version,
-   {"801":{"102":null}} Firmware version realease day,
-   {"895":{"100 - 105":null}} SD-Card info, displayed [101|103|102|100] - 104(month)/105(year)
