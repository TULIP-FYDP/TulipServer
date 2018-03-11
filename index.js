// Library Imports
const express = require('express');
const http = require('http');
const url = require('url');
const WebSocket = require('ws');

const app = express();

// app.use(function (req, res) {
//     res.send({ msg: "hello" });
// });

app.get('/', (req, res) => res.send('Hello World!'))

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


// Broadcast to all.
wss.broadcast = function broadcast(data) {
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
};

wss.on('connection', function connection(ws) {
    ws.on('message', function incoming(data) {
        // Broadcast to everyone else.
        wss.clients.forEach(function each(client) {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    });
});

server.listen(8080, function listening() {
    console.log('Listening on %d', server.address().port);
});
