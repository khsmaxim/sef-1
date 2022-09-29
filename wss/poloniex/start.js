// https://github.com/dutu/poloniex-api-node
// https://github.com/jyap808/go-poloniex/blob/master/poloniex.go
// https://pastebin.com/dMX7mZE0

const ws = require('ws');
const http = require('http');
const url = require('url');
var globals = require("./globals");
var orderBook = require('./orderBook');

var wss = {};
globals.pairs.forEach((pair, index) => {
  var route = "/orderBook/" + pair;
  wss[route] = new ws.Server({noServer: true});
  wss[route].on('connection', function(client, req) {
    console.log("connection on " + route);
    // const ip = req.connection.remoteAddress;
    // client.on('message', function incoming(message) {
    //  console.log('received on server: %s', message);
    // });
    var data = orderBook.getData(pair);
    if (data.seq) {
      try {
        client.send(JSON.stringify(data));
        // client.send(JSON.stringify({'type':globals.ASK, 'data':data.asks}));
        // client.send(JSON.stringify({'type':globals.BID, 'data':data.bids}));
      }
      catch (err) {
        console.info(err);
      }
    }
    client.on('close', (code, message) => {
      console.log('ws.close', code)
    });
    client.on('error', (err) => {
      console.log('ws.error', err);
    });
  });
});

var httpServer = http.createServer();
httpServer.listen(10080, '127.0.0.1');
httpServer.on('upgrade', (request, socket, head) => {
  const route = url.parse(request.url).pathname;
  if (!wss.hasOwnProperty(route)) socket.destroy();
  wss[route].handleUpgrade(request, socket, head, (client) => {
    wss[route].emit('connection', client);
  });
});

orderBook.on('changed', function(/*type,*/ pair, data) {
  var route = "/orderBook/" + pair;
  wss[route].clients.forEach(function each(client) {
    if (client.readyState === ws.OPEN) {
      try {
        client.send(JSON.stringify(data[pair]));
        // client.send(JSON.stringify({'type':type, 'data':data}));
      }
      catch (err) {
        console.log('changed.send.err', err);
      }
    }
  });
});

orderBook.on('error', function(message) {
  console.log('orderBook.error', message);
  for (var item in wss) {
    wss[item].clients.forEach(function each(client) {
      if (client.readyState === ws.OPEN) {
        try {
          client.send(JSON.stringify({'error': message}));
        }
        catch (err) {
          console.log('error.send.err', err);
        }
      }
    });
  }
});

// SEND ERROR
/* setTimeout(function() {
  for (var item in wss) {
    wss[item].clients.forEach(function each(client) {
      if (client.readyState === ws.OPEN) {
        try {
          client.send(JSON.stringify({'error': 'CUSTOM ERROR'}));
        }
        catch (err) {
          console.log('error.send.err', err);
        }
      }
    });
  }
}, 30000); */

orderBook.subscribe();


process
  .on('SIGINT', function() { // ctrl+c
    orderBook.unsubscribe();
    console.info('EXITING...');
    setTimeout(() => {
      process.exit();
    }, 1000);
  })
  .on('exit', function() {
    // process.kill(process.pid, 'SIGTERM');
  });