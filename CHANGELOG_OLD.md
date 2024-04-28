# Older changes
## 2.2.3

-   got => axios, usage of async functions

## 2.2.2

-   set ready for js-controller 4.x

## 2.2.1

-   replaced 'request' by 'got', node.js >= 12.

## 2.1.5

-   bugfix (variable type).

## 2.1.4

-   history-/selfconsumption-data for SL500 added.

## 2.1.3

-   bugfixes (js-controller 3.3.x)

## 2.1.1

-   Cockpit- (consumption/production/battery/feed) and LCD-display data added. Polling structure optimized for a faster polling of certain values ('live'-data).

## 2.0.2

-   smart energy 'switch group' data added.

## 2.0.1

-   bugfix (better timing to set inverter data).

## 2.0.0

-   Complete code redesign to reduce traffic between adapter and solarlog. NEW: System informations (info) and solarlogs setpoint-values for year, current and all month and current day (forecast).

## 1.3.0

-   user-login possibility added.

## 1.2.4

-   .npmignore and .gitignore added, small bugfix

## 1.2.3

-   Readme/License update.

## 1.2.2

-   It is now possible to set the time when historic data is requested.

## 1.2.1

-   'Forecast' - bug fixed (forecast request now only submitted if forecast is activated), dependencies updated.

## 1.2.0

-   Shows now forecast data: today's and tomorrow's total kWh. Completed translations in words.js.

## 1.1.0

-   Shows detailed information on self - consumption. Imports yearly & monthly historic data.

## 1.0.0

-   Reads now device types, -brands and -classes. Sets correct params for batteries. Displays self-consumption @'status'

## 0.1.6

-   Reads now battery data

## 0.1.5

-   Reads now historic data (yearly sum per Inverter), testing update

## 0.1.4

-   Readme - update

## 0.1.3

-   Core Files/Testing Update and introduce adapter-core

## 0.1.2

-   Inverter/meter - detection optimized

## 0.1.1

-   support for compact mode

## 0.1.0

-   optional port declaration, readme updated

## 0.0.9

-   another bugfix daysum - function

## 0.0.8

-   bugfix daysum - function

## 0.0.7

-   import of daily sum of production/consumption per inverter/meter in Wh
-   info connection state fixed

## 0.0.6

-   optimized evaluation of number of inverters/meters to import

## 0.0.5

-   better readme
-   correct labels in config-dialogue

Planned for next version: reading solarlog smart energy settings and states

## 0.0.4

-   Inverter-import optional
-   Error - logs refer to functions
-   better readme

Planned for next version: reading solarlog smart energy settings and states

## 0.0.3

New functions added!

-   reads all defined inverters/meters
-   set objects named as in solarlog
-   get values (current production/consumption) and states for each inverter

Planned for next version: reading solarlog smart energy settings and states

## 0.0.2 First running version

Defined objects:

-   Time last data sync
-   Installed generator power
-   Total output PAC from all the inverters and meters in inverter mode.
-   Total output PAC from all the inverters
-   Average voltage UAC from the inverter
-   Average voltage UDC from the inverter
-   Total yield for the day from all the inverters
-   Total yield for the previous day from all the inverters
-   Total yield for the month from all the inverters
-   Total yield for the year from all the inverters
-   Total yield from all the inverters
-   Current total consumption PAC from all the consumption meters
-   Total consumption from all the consumption meters
-   Total consumption for the previous day; all the consumption meters
-   Total consumption for the month; all the consumption meters
-   Total consumption for the year; all the consumption meters
-   Accumulated total consumption, all Consumption meter

Planned Objects:

-   Description/Yield/Consumption of all connected inverters and meters