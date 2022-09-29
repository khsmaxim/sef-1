const emitter = require('events').EventEmitter;
const util = require('util');
const Big = require('big.js');
const Pusher = require('pusher-js');
const http = require('http');
const querystring = require('querystring');
const globals = require("./../../globals");
const max = require("./../../plugins/max/package.js");
const Busy = require("./core/Busy");
const output = require("./../Output");

var Bitstamp = function () {
  var that = this;
  this.name = globals.BITSTAMP;

  this.fee = {
    maker: 0.25, // %
    taker: 0.25, // %
  };

  var top = {};
  globals.pairs.app.forEach((pair, index) => {
    top[pair] = {
      asks: [],
      ask: {
        price: function(ii) { return new Big(top[pair].asks[ii][0]); },
        amount: function(ii) { return new Big(top[pair].asks[ii][1]); },
        amounts: function(ii) {
          var price = Number(top[pair].asks[ii][0]);
          var amount = new Big(0);
          do {
            amount = amount.plus(Number(top[pair].asks[ii][1]));
            ii ++;
          } while(top[pair].asks.length > ii && price == Number(top[pair].asks[ii][0]))
          return amount;
        },
        cut: function(length) { return JSON.parse(JSON.stringify(top[pair].asks.slice(0, length))); },
      },
      bids: [],
      bid: {
        price: function(ii) { return new Big(top[pair].bids[ii][0]); },
        amount: function(ii) { return new Big(top[pair].bids[ii][1]); },
        amounts: function(ii) {
          var price = Number(top[pair].bids[ii][0]);
          var amount = new Big(0);
          do {
            amount = amount.plus(Number(top[pair].bids[ii][1]));
            ii ++;
          } while(top[pair].bids.length > ii && price == Number(top[pair].bids[ii][0]))
          return amount;
        },
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
          output.out('WSS:BITSTAMP', locked ? 'LOCK' : 'UNLOCK');
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
    })();
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
    var pusher = new Pusher('de504dc5763aeef9ff52');
    return {
      orderBook: (function() {
        var subscriptions = {};
        globals.pairs.app.forEach((pair, index) => {
          subscriptions[pair] = (function() {
            var _pair = pair;
            var _pairAlt = globals.pairs.alt(_pair, globals.BITSTAMP);
            var _channel;
            var _channelName = 'order_book' + (_pairAlt == 'btcusd' ? '' : '_' + _pairAlt);
            var _lockTimerID = null;
            var _dcTimerID = null;
            var _subscribe = function() {
              output.out('WSS:BITSTAMP', 'SUBSCRIBE');
              _channel = pusher.subscribe(_channelName);
              // _channel.bind('pusher:subscription_succeeded', function() {});
              _channel.bind('data', function (data) {
                try {
                  if (typeof data !== "object" || data == null) {
                    throw new Error('Invalid content-type.');
                  }
                }
                catch(err) {
                  output.out('WSS:BITSTAMP', err.message);
                  _lock();
                  return;
                }
                clearTimeout(_lockTimerID);
                _lockTimerID = null;
                var prevAsk = top[_pair].asks[0] || [null, null];
                var prevBid = top[_pair].bids[0] || [null, null];
                top[_pair].asks = data.asks;
                top[_pair].bids = data.bids;
                top[_pair].updated = new Date();
                top[_pair].locked = false;
                if (data.asks.length) {
                  if (!(prevAsk[0] == data.asks[0][0] && prevAsk[1] == data.asks[0][1])) {
                    that.emit('compare', globals.ASK, _pair);
                  }
                }
                if (data.bids.length) {
                  if (!(prevBid[0] == data.bids[0][0] && prevBid[1] == data.bids[0][1])) {
                    that.emit('compare', globals.BID, _pair);
                  }
                }
              });
              _channel.bind('pusher:subscription_error', function(status) {
                output.out('WSS:BITSTAMP', 'Subscription error. Status='+status);
                // 408 Request Timeout
                // 503 Service Unavailable
                if (status == 408 || status == 503) {
                  _resubscribe();
                }
                else {
                  _lock();
                }
              });
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
              _channel.unbind();
              pusher.unsubscribe(_channelName);
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
              if (_channel) {
                _channel.unbind();
                pusher.unsubscribe(_channelName);
              }
              output.out('WSS:BITSTAMP', 'UNSUBSCRIBE');
            };
            return {
              pair: _pair,
              channel: _channel,
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
        var pairAlt = globals.pairs.alt(pair, globals.BITSTAMP);
        var data = querystring.stringify({
          'pair' : pairAlt,
        });
        var options = {
          host: 'phpapi.sef.com',
          port: '80',
          path: '/api/bitstamp/order',
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
util.inherits(Bitstamp, emitter);

module.exports = Bitstamp;