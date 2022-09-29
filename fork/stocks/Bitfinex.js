const emitter = require('events').EventEmitter;
const util = require('util');
const Big = require('big.js');
const BFX = require('bitfinex-api-node')
const http = require('http');
const querystring = require('querystring');
const globals = require("./../../globals");
const max = require("./../../plugins/max/package.js");
const Busy = require("./core/Busy");
const output = require("./../Output");

var Bitfinex = function () {
  var that = this;
  this.name = globals.BITFINEX;

  this.fee = {
    maker: 0.1, // %
    taker: 0.2, // %
  };

  const bfx = new BFX({
    apiKey: '',
    apiSecret: '',
    ws: {
      autoReconnect: true,
      seqAudit: true,
      packetWDDelay: 10 * 1000
    }
  });

  var top = {};
  globals.pairs.app.forEach((pair, index) => {
    top[pair] = {
      asks: [],
      ask: {
        price: function(ii) { return new Big(top[pair].asks[ii][0]); },
        amount: function(ii) { return new Big(top[pair].asks[ii][2]); },
        amounts: function(ii) { return (new Big(top[pair].asks[ii][2])).times(top[pair].asks[ii][1]); },
        cut: function(length) { return JSON.parse(JSON.stringify(top[pair].asks.slice(0, length))); },
      },
      bids: [],
      bid: {
        price: function(ii) { return new Big(top[pair].bids[ii][0]); },
        amount: function(ii) { return (new Big(top[pair].bids[ii][2])).times(-1); },
        amounts: function(ii) { return (new Big(top[pair].bids[ii][2])).times(top[pair].bids[ii][1]).times(-1); },
        cut: function(length) { return JSON.parse(JSON.stringify(top[pair].bids.slice(0, length))); },
      },
      updated: null,
      order: {}
    };
    (function() {
      var locked = true;
      Object.defineProperty(top[pair], 'locked', {
        get: function() {
          return locked;
        },
        set: function(value) {
          if (locked == value) return;
          locked = value;
          output.out('WSS:BITFINEX', locked ? 'LOCK' : 'UNLOCK');
        }
      });
    })();
    (function() {
      var _value = 0;
      Object.defineProperty(top[pair].order, globals.BUY, {
        get: function() { return _value; },
        set: function(value) { _value = Math.max(0, value); }
      });
    })();
    (function() {
      var _value = 0;
      Object.defineProperty(top[pair].order, globals.SELL, {
        get: function() { return _value; },
        set: function(value) { _value = Math.max(0, value); }
      });
    })()
  });
  this.top = top;

  this.busy = new Busy(() => {
    for (var pair in top) {
      if (top[pair].order[globals.BUY] || top[pair].order[globals.SELL]) {
        return true;
      }
    };
    return false;
  });

  this.req = (function() {
    return {
      orderBook: (function() {
        var subscriptions = {};
        globals.pairs.app.forEach((pair, index) => {
          subscriptions[pair] = (function() {
            var _pair = pair;
            var _pairAlt = globals.pairs.alt(_pair, globals.BITFINEX);
            var _ws;
            var _lockTimerID = null;
            var _dcTimerID = null;
            var _subscribe = function() {
              output.out('WSS:BITFINEX', 'SUBSCRIBE');
              _ws = bfx.ws(2, {
                manageOrderBooks: true,  // tell the ws client to maintain full sorted OBs
                transform: true,         // auto-transform array OBs to OrderBook objects
              });
              _ws.on('open', () => {
                _ws.subscribeOrderBook(pairAlt);
              });
              _ws.onOrderBook({ symbol: pairAlt }, (data) => {
                clearTimeout(_lockTimerID);
                _lockTimerID = null;
                var prevAsk = top[_pair].asks[0] || [null, null, null];
                var prevBid = top[_pair].bids[0] || [null, null, null];
                top[_pair].asks = data.asks;
                top[_pair].bids = data.bids;
                top[_pair].updated = new Date();
                top[_pair].locked = false;
                if (data.asks.length) {
                  if (!(prevAsk[0] == data.asks[0][0] && prevAsk[2] == data.asks[0][2])) {
                    that.emit('compare', globals.ASK, _pair);
                  }
                }
                if (data.bids.length) {
                  if (!(prevBid[0] == data.bids[0][0] && prevBid[2] == data.bids[0][2])) {
                    that.emit('compare', globals.BID, _pair);
                  }
                }
              });
              _ws.on('error', (err) => {
                output.out('WSS:BITFINEX', err);
                _resubscribe();
              });
              _ws.open();
            };
            var _lock = function() {
              // dismiss if timer active
              if (_lockTimerID) return;
              // dismiss if already locked
              if (top[_pair].locked) return;
              // lock for compare after X sec
              _lockTimerID = setTimeout(() => {
                top[_pair].locked = true;
              }, 5000);
            };
            var _resubscribe = function() {
              _lock();
              _ws.unsubscribeOrderBook(_pair);
              _ws.close();
              // try to reconnect aftre X sec
              _dcTimerID = setTimeout(() => {
                _subscribe();
              }, 10000);
              that.emit('disconnected', _pair);
            };
            var _unsubscribe = function() {
              top[_pair].locked = true;
              clearTimeout(_lockTimerID);
              _lockTimerID = null;
              clearTimeout(_dcTimerID);
              _dcTimerID = null;
              if (_ws) {
                _ws.unsubscribeOrderBook(_pair);
                _ws.close();
              }
              output.out('WSS:BITFINEX', 'UNSUBSCRIBE');
            };
            return {
              pair: _pair,
              subscribe: _subscribe,
              unsubscribe: _unsubscribe
            };
          })();
        });
        return {
          subscriptions: subscriptions,
          subscribe: function(pair) {
            subscriptions[pair].subscribe();
          },
          unsubscribe: function(pair) {
            subscriptions[pair].unsubscribe();
          },
          subscribeAll: function() {
            for (var pair in subscriptions) {
              subscriptions[pair].subscribe();
            };
          },
          unsubscribeAll: function() {
            for (var pair in subscriptions) {
              subscriptions[pair].unsubscribe();
            };
          }
        };
      })(),
      order: function(pair, callback) {
        var pairAlt = globals.pairs.alt(pair, globals.BITFINEX);
        var data = querystring.stringify({
          'pair' : pairAlt,
        });
        var options = {
          host: 'phpapi.sef.com',
          port: '80',
          path: '/api/bitfinex/order',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data)
          }
        };
        var post = http.request(options, (response) => {
          let result = '';
          response.setEncoding('utf8');
          // console.log(`STATUS: ${response.statusCode}`);
          // console.log(JSON.stringify(response.headers));
          // console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
          // A chunk of data has been recieved.
          response.on('data', (chunk) => {
            // console.log(`BODY: ${chunk}`);
            result += chunk;
          });
          // The whole response has been received. Print out the result.
          response.on('end', () => {
            // console.log(JSON.parse(result));
            try {
              if (response.statusCode !== 200) {
                throw new Error('HTTP Code ' + response.statusCode);
              }
              var json = JSON.parse(result);
              if (!(typeof json === 'object' && json !== null)) {
                throw new Error('Wrong format request');
              }
              // TODO: parser stock exchange custom errors
              max.utils.callback.handle(callback, 'success', json);
              max.utils.callback.handle(callback, 'final');
            }
            catch(e) {
              max.utils.callback.handle(callback, 'error', e, result);
              max.utils.callback.handle(callback, 'final');
            }
          });
        });
        post.on('error', (e) => {
          // console.error(`problem with request: ${e.message}`);
          max.utils.callback.handle(callback, 'error', e, null);
          max.utils.callback.handle(callback, 'final');
        });
        post.write(data);
        post.end();
      }
    }
  })();

  return this;
};
util.inherits(Bitfinex, emitter);

module.exports = Bitfinex;