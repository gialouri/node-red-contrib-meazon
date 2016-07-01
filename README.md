# node-red-contrib-meazon

A set of Node-RED nodes for working with [Meazon](http://meazon.com/) devices.

Meazon designs and manufactures at scale revolutionary small size IoT energy meters and integrates them with cloud technology.


Install
-------

Run the following command in your Node-RED user directory - typically `~/.node-red`

    npm install node-red-contrib-meazon


## Output node

With the output node you can control any Meazon device with relay (Izy/Bizy Plugs and Dinrails)

On the configuration panel you can set

    URL  :  ws://{GatewayIP}:2014
    MAC  :  Select the Device MAC Address
    
    Number  :  Device Endpoint
               Bizy Devices  :  10
               Izy Devices   :  9
               Sensor        :  1

    


## Input Node

You can use the input node to get the device measurements. Leaving the descirptor field empty 
you are having a full dictionary with the reported values.
The output for a 3Phase Dinrail look like this:


```
	{ "frq": 49.85, "pwrA": 1296.65, "pwrB": 4883.491, 
	  "pwrC": 1368.955, "vltA": 230.367, "vltB": 229.857, 
	  "vltC": 232.425, "curA": 6.751, "curB": 21.52, "curC": 7.158 }
```

```
	{ "rpwrA": 849.443, "rpwrB": 346.577, "rpwrC": 968.926 }
```

```
	{ "dxi": 0 }
```

```
	{ "relay": 1, "online": 1 }
```

	frq 	:	Network Frequency
	
	pwrA	:	Power Phase A (Watt)
	pwrB	:	Power Phase B (Watt)
	pwrC	:	Power Phase C (Watt)
	
	vltA	:	Voltage Phase A (Volt)
	vltB	:	Voltage Phase B (Volt)
	vltC	:	Voltage Phase C (Volt)
	
	curA	:	Current Phase A (Amper)
	curB	:	Current Phase B (Amper)
	curC	:	Current Phase C (Amper)
	
	rpwrA	:	Reactive Power A (Var)
	rpwrB	:	Reactive Power B (Var)
	rpwrC	:	Reactive Power C (Var)
	
	dxi	    :	Digital External Input (High/Low)
	relay	:	Relay Status (On/Off)
	online	:	Device Status (Online/Offline)
	
    tmp     :  Temperature (C) 
    hmd     :  Humidity (%) 
    occ     :  Occupancy Alarm (0/1)
    batvlt  :  Battery Voltage (V) 
    batlrm  :  Battery Alarm (0/1) 