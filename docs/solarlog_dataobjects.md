# Solarlog data objects

## Offical JSON-request

-   {"801":{"170":null}} Result see user manual

## OTHERS

All these requests have benn discovered by analyzing the solarlog webinterface with google's debeloper - tools.

### Device data (inverters/meters/batteries/other)

-   {"740":null} Serial numbers of connected devices (if it's not "Err", you know there is a device on this position).

-   {"141":{"i":{"119":null}}} Name of inverter. i = Position in the objekt "740", above. !! Do not call the entire "141" - object, it lasts very long or your solarlog can't handle that.

-   {"141":{"i":{"162":null}}} Device specification. i = Position in the objekt "740", above. !! Do not call the entire "141" - object, it lasts very long or your solarlog can't handle that.

-   {"739":null} list of all possible devices. Specifications for every device such as brandcode[0](<brands found in> "744"), name[1], deviceclasscode[5](<deviceclass: 1:Wechselrichter, 2:Sensor, 4:Schalter, 8: Hybrid-System, 16: Batterie, 32: Intelligente Verbraucher, 64: Schalter, 128: Wärmepumpe, 256: Heizstab, 512: Ladestation>).

-   {"744":null} list of all brands / brandcodes

-   {"782":null} consumption/Production per inverter/meter.
-   {"608":null} Status per inverter/meter.

-   {"776"::null} 5-min consumption/production per inverter/meter.
-   {"777"::null} daily consumption/production per inverter/meter.
-   {"778"::null} daily self - consumption; self-consuption, charge & discharge energy of battery if connected.
-   {"779"::null} monthly consumption/production per inverter/meter.
-   {"854":null} yealry consumption/production per inverter/meter.
-   {"858":null} voltage, level, charge & discharge power of battery. Empty if no battery is connected.
-   {"877":null} monthly values for production (Wh), consuption (Wh) and self-consumption (kWh).
-   {"878":null} yearly values for production (Wh), consuption (Wh) and self-consumption (kWh).

### Smart energy data

-   {"447":null} defined switching groups (Schaltgruppen): 100: name, 102: manual set states,
-   {"449":null} cofiguration of switching groups: 103: switching levels

### Other data

-   {"152"::null} 0-11: monthly % of total production estimated, 161: kWp installed, 162: kWh/kWp p.a. estimated.
-   {"141":{"i":{"708/709/710"}}} list of events per device: 708: list of possible events, 709: error codes,
    710: 100 last events (timestamps start, end, 0, eventcode, errorcode)

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
