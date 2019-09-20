WebSocketClient = require('websocket').client;
var wsURL = process.env.wsURL;
var client;
var wscon = null;

module.exports.initWS = function() {
    client = new WebSocketClient();
    client.connect(wsURL);

    client.on('connect', function(connection) {
        console.log('WebSocket Client Connected');
        wscon = connection;

        connection.on('error', function(error) {
           wscon = null;
           console.log("Connection Error: " + error.toString());
        });

        connection.on('close', function() {
           wscon = null;
           console.log('Connection Closed');
        });

        connection.on('message', function(message) {
          if (message.type === 'utf8') {
             console.log("Received: '" + message.utf8Data + "'");
          }
        });
    });

}

module.exports.sendProgress = function(location, number, msg) {
    console.log("wscon = " + wscon);
    if (wscon != null && wscon.connected) {
         //var number = Math.round(Math.random() * 100);
         var data ={'location':location, 'value': number, 'msg': msg};
         wscon.send(JSON.stringify(data));
    }
}
