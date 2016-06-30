/**
 * Copyright 2013, 2016 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function(RED) {
    "use strict";
    var ws = require("ws");
  //  var inspect = require("util").inspect;

    // A node red node that sets up a local websocket server
    function WebSocketListenerNode(n) {
        // Create a RED node
		console.log(n.mac)
        RED.nodes.createNode(this,n);
		this.mac = n.mac;		
		this.descr = n.descr;
        var node = this;
		node.mac = n.mac;		
		node.descr = n.descr;
		node.number = n.number ? n.number : 10;
		node.selectedIndex = n.selectedIndex;
		console.log("MAC in WebSocketListenerNode: " + node.mac);	
		
        // Store local copies of the node configuration (as defined in the .html)
        node.path = n.path;
        node.wholemsg = (n.wholemsg === "true");

        node._inputNodes = [];    // collection of nodes that want to receive events
        node._clients = {};
        // match absolute url
        node.isServer = !/^ws{1,2}:\/\//i.test(node.path);
		console.log("node is server? " + node.isServer)
        node.closing = false;

        function startconn() {    // Connect to remote endpoint
            var socket = new ws(node.path);
            node.server = socket; // keep for closing
            handleConnection(socket);
        }

        function handleConnection(/*socket*/socket) {
            var id = (1+Math.random()*4294967295).toString(16);
			//node._clients[id] = socket;
            if (node.isServer) { node._clients[id] = socket; node.emit('opened',Object.keys(node._clients).length); }
            socket.on('open',function() {
                if (!node.isServer) { node.emit('opened',''); }
            });
            socket.on('close',function() {
                if (node.isServer) { delete node._clients[id]; node.emit('closed',Object.keys(node._clients).length); }
                else { node.emit('closed'); }
                if (!node.closing && !node.isServer) {
                    node.tout = setTimeout(function(){ startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            });
            socket.on('message',function(data,flags){
                node.handleEvent(id,socket,'message',data,flags,node.mac);
            });
            socket.on('error', function(err) {
                node.emit('erro');
                if (!node.closing && !node.isServer) {
                    node.tout = setTimeout(function(){ startconn(); }, 3000); // try to reconnect every 3 secs... bit fast ?
                }
            });
        }

        if (node.isServer) {	
		
            var path = RED.settings.httpNodeRoot || "/";
            path = path + (path.slice(-1) == "/" ? "":"/") + (node.path.charAt(0) == "/" ? node.path.substring(1) : node.path);

            // Workaround https://github.com/einaros/ws/pull/253
            // Listen for 'newListener' events from RED.server
            node._serverListeners = {};

            var storeListener = function(/*String*/event,/*function*/listener){
                if(event == "error" || event == "upgrade" || event == "listening"){
                    node._serverListeners[event] = listener;
                }
            }

            RED.server.addListener('newListener',storeListener);

            // Create a WebSocket Server
            node.server = new ws.Server({
                server:RED.server,
                path:path,
                // Disable the deflate option due to this issue
                //  https://github.com/websockets/ws/pull/632
                // that is fixed in the 1.x release of the ws module
                // that we cannot currently pickup as it drops node 0.10 support
                perMessageDeflate: false
            });

            // Workaround https://github.com/einaros/ws/pull/253
            // Stop listening for new listener events
            RED.server.removeListener('newListener',storeListener);
            node.server.on('connection', handleConnection);
			
        }
        else {
            node.closing = false;
            startconn(); // start outbound connection
        }

        node.on("close", function() {
            // Workaround https://github.com/einaros/ws/pull/253
            // Remove listeners from RED.server
            if (node.isServer) {
                var listener = null;
                for (var event in node._serverListeners) {
                    if (node._serverListeners.hasOwnProperty(event)) {
                        listener = node._serverListeners[event];
                        if (typeof listener === "function") {
                            RED.server.removeListener(event,listener);
                        }
                    }
                }
                node._serverListeners = {};
                node.server.close();
                node._inputNodes = [];
            }
            else {
                node.closing = true;
                node.server.close();
                if (node.tout) { clearTimeout(node.tout); }
            }
        });
    }
    RED.nodes.registerType("meazon-listener",WebSocketListenerNode);
    RED.nodes.registerType("meazon-client",WebSocketListenerNode);

    WebSocketListenerNode.prototype.registerInputNode = function(/*Node*/handler) {
		//this.mac = handler.mac;
		//this.descr = handler.descr;
        this._inputNodes.push(handler);
    }

    WebSocketListenerNode.prototype.removeInputNode = function(/*Node*/handler) {
        this._inputNodes.forEach(function(node, i, inputNodes) {
            if (node === handler) {
                inputNodes.splice(i, 1);
            }
        });
    }

	WebSocketListenerNode.prototype.handleEvent = function(id,/*socket*/socket,/*String*/event,/*Object*/data,/*Object*/flags,mac){
 	    var messageType = ['MeterValues','PlugState'];
		var msg = {};
		var message = {};
		var commandPayload = data.split(' ');
		var virtualDescs = {online: 'IsOnline', relay: 'IsOn'}
		
        console.log("Type: " + commandPayload[0]);
		msg._session = {type:"websocket",id:id};
		if(commandPayload[0] == messageType[0]){
			commandPayload.splice(0,1);
			message =JSON.parse(commandPayload.join(''));
			msg.DT = message.DT;
			for (var i = 0; i < this._inputNodes.length; i++) {
				/*all key,values*/
				if(((parseInt(message.xMAC,16) == this._inputNodes[i].mac) || (message.xMAC.toLowerCase() == this._inputNodes[i].mac.toLowerCase()) ) &&  (message.Number.toString() == this._inputNodes[i].number.toString())&& (this._inputNodes[i].descr == "")){
					msg.payload = {};
					for(var j=0; j< message.KVs.length;j++){
						msg.payload[message.KVs[j].K]= parseFloat(message.KVs[j].V);
					}
					this._inputNodes[i].send(msg);
				}
				/* selected desc*/
				for(var j = 0; j< message.KVs.length;j++){				
					if(((parseInt(message.xMAC,16) == this._inputNodes[i].mac) || (message.xMAC.toLowerCase() == this._inputNodes[i].mac.toLowerCase()) ) &&  (message.Number.toString() == this._inputNodes[i].number.toString())&& (message.KVs[j].K.toLowerCase() == this._inputNodes[i].descr.toLowerCase())){
						msg.payload = parseFloat(message.KVs[j].V);
						msg.descr = message.KVs[j].K;
						this._inputNodes[i].send(msg);
						console.log("SEND " + msg.payload)
					}
				}	
			}
		}
		else if(commandPayload[0] == messageType[1]){
			commandPayload.splice(0,1);
			message = JSON.parse( commandPayload.join(''));
			msg.DT = message.DT;
			for (var i = 0; i < this._inputNodes.length; i++) {
			 	if(((parseInt(message.xMAC,16) == this._inputNodes[i].mac) || (message.xMAC.toLowerCase() == this._inputNodes[i].mac.toLowerCase()) ) && (message.Number.toString() == this._inputNodes[i].number.toString())){
					if(virtualDescs[this._inputNodes[i].descr]){
						msg.payload = message[virtualDescs[this._inputNodes[i].descr]] ? 1 : 0;
						msg.number = parseInt(message.Number);
						msg.descr = this._inputNodes[i].descr;
						this._inputNodes[i].send(msg);
						console.log(message.xMAC+ " IsOn: " + message.IsOn)
					}else if(this._inputNodes[i].descr == ""){
						msg.payload = {relay: message.IsOn ? 1:0, online: message.IsOnline ? 1:0}
						msg.number = parseInt(message.Number);
						this._inputNodes[i].send(msg);

					}
				}
			}
		}
    }	

    WebSocketListenerNode.prototype.broadcast = function(data) {
        try {
            if(this.isServer) {
                for (var i = 0; i < this.server.clients.length; i++) {
                    this.server.clients[i].send(data);
                }
            }
            else {
				console.log("server send " + data)
                this.server.send(data);
            }
        }
        catch(e) { // swallow any errors
            this.warn("ws:"+i+" : "+e);
        }
    }

    WebSocketListenerNode.prototype.reply = function(id,data) {
		console.log("sess id " + id)
        var session = this._clients[id];
				console.log(session)

        if (session) {
            try {		
			console.log(data)
                session.send(data);
            }
            catch(e) { // swallow any errors
				console.log("session exception " + e)

            }
        }else{     
			this.server.send(data); ///????????????
			console.log(data)

		}
    }

    function WebSocketInNode(n) {
        RED.nodes.createNode(this,n);
		this.mac = n.mac;		
		this.descr = n.descr;
		this.number = n.number;
		this.number = n.number ? n.number : 10;

		this.selectedIndex = n.selectedIndex;

        var node = this;
		console.log("MAC in WebSocketInNode: " +  node.mac + " descr: " + node.descr);	
       
 	    this.server = (n.client)?n.client:n.server;
        this.serverConfig = RED.nodes.getNode(this.server);
        if (this.serverConfig) {
            this.serverConfig.registerInputNode(this);
            // TODO: nls
            this.serverConfig.on('opened', function(n) { node.status({fill:"green",shape:"dot",text:"connected "+n}); });
            this.serverConfig.on('erro', function() { node.status({fill:"red",shape:"ring",text:"error"}); });
            this.serverConfig.on('closed', function() { node.status({fill:"red",shape:"ring",text:"disconnected"}); });
        } else {
            this.error(RED._("websocket.errors.missing-conf"));
        }

        this.on('close', function() {
            node.serverConfig.removeInputNode(node);
        });

    }
	
    RED.nodes.registerType("meazon in",WebSocketInNode);

    function WebSocketOutNode(n) {
        RED.nodes.createNode(this,n);	
		this.mac = n.mac;
		this.number = n.number ? n.number : 10;
		this.action = n.action;
   		this.selectedIndex = n.selectedIndex;

		var node = this;

		console.log("MAC in WebSocketOutNode: " + node.mac + " action: " + node.action);	
        this.server = (n.client)?n.client:n.server;
        this.serverConfig = RED.nodes.getNode(this.server);
        if (!this.serverConfig) {
            this.error(RED._("websocket.errors.missing-conf"));
        }
        else {
            // TODO: nls
            this.serverConfig.on('opened', function(n) { node.status({fill:"green",shape:"dot",text:"connected "+n}); });
            this.serverConfig.on('erro', function() { node.status({fill:"red",shape:"ring",text:"error"}); });
            this.serverConfig.on('closed', function() { node.status({fill:"red",shape:"ring",text:"disconnected"}); });
        }
        this.on("input", function(msg) {
			
			console.log('HERE SEND TO WS '+ node.mac +" Action " +  node.action + "Number: "+ node.number) 
			console.log(msg)
            var payload;
			var mac = isHex(node.mac) ? parseInt(node.mac,16) : parseInt(node.mac,10);
			if(node.action == "true"){ 
				payload = 'TurnOn {"MAC":' + mac + ',"Number":'+node.number+'}';
			}else{
				payload = 'TurnOff {"MAC":' + mac + ',"Number":'+node.number+'}';
			}			

            if (payload) {
                if (msg._session && msg._session.type == "websocket") { 
					console.log(" type websocket")
                    node.serverConfig.reply(msg._session.id,payload);
                } else {				
					console.log(" else type websocket")
                    node.serverConfig.broadcast(payload,function(error){
                        if (!!error) {
                           // node.warn(RED._("websocket.errors.send-error")+inspect(error));
                        }
                    });
                }
            }
        });
    }
	
	//helper functions
	function isHex(h) {
		var a = parseInt(h,16);
		return (a.toString(16) ===h.toLowerCase())
	}
	
    RED.nodes.registerType("meazon out",WebSocketOutNode);
}
