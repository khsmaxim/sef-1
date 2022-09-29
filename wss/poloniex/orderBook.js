var emitter = require('events').EventEmitter;
var util = require('util');
var https = require('https');
var globals = require("./globals");

var OrderBook = function () {
	var that = this;
	var reqTimerID = 0;
	var allow = false;

	var data = {};
	globals.pairs.forEach((pair, index) => {
		data[pair] = {
			asks: [[]],
			bids: [[]],
			isFrozen: null,
			seq: null,
		}
	});

	var get = function(pair, depth, successHandler, errorHandler, finalHandler) {
		https.get('https://poloniex.com/public?command=returnOrderBook&currencyPair='+pair+'&depth='+depth,
			(res) => {
				const { statusCode } = res;
				const contentType = res.headers['content-type'];
				let error;
				if (statusCode !== 200) {
					error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
				}
				else if (!/^application\/json/.test(contentType)) {
					error = new Error('Invalid content-type.\n' + `Expected application/json but received ${contentType}`);
				}
				if (error) {
					errorHandler(error.message);
					// consume response data to free up memory
					res.resume();
					return;
				}
				res.setEncoding('utf8');
				let rawData = '';
				res.on('data', (chunk) => { rawData += chunk; });
				res.on('end', () => {
					try {
						const parsedData = JSON.parse(rawData);
						successHandler(parsedData);
						finalHandler();
					}
					catch (e) {
						errorHandler(e.message);
						finalHandler();
					}
				});
			})
			.on('error', (e) => {
				errorHandler(`Got error: ${e.message}`);
			});
	};

	// var a = 0;
	var subscribe = function() {
		get('all', 25,
			(response) => {
				/* a++;
				if (a > 20) {
					console.info('send a error');
					that.emit('error', 'a exit');
					setTimeout(() => {
						console.info('a=0');
						a=0;
					}, 4000);
					return;
				} */
				if (!allow) return;
				globals.pairs.forEach((pair, index) => {
					var prevAsk = data[pair].asks[0];
					var prevBid = data[pair].bids[0];
					data[pair].asks = response[pair].asks;
					data[pair].bids = response[pair].bids;
					data[pair].isFrozen = response[pair].isFrozen;
					data[pair].seq = response[pair].seq;
					that.emit('changed', pair, data);
					/* if (!(prevAsk[0] == response[pair].asks[0][0] && prevAsk[1] == response[pair].asks[0][1])) {
						that.emit('changed', globals.ASK, pair, data[pair].asks);
					}
					if (!(prevBid[0] == response[pair].bids[0][0] && prevBid[1] == response[pair].bids[0][1])) {
						that.emit('changed', globals.BID, pair, data[pair].bids);
					} */
				});
			},
			(message) => {
				if (!allow) return;
				that.emit('error', message);
				console.info(message);
			},
			() => {
				if (!allow) return;
				reqTimerID = setTimeout(subscribe, 1000);
			});
	};

	this.subscribe = function() {
		allow = true;
		subscribe();
	};

	this.unsubscribe = function() {
		allow = false;
		clearTimeout(reqTimerID);
	};

	this.getData = function(pair) {
		return data[pair];
	};
};
util.inherits(OrderBook, emitter);

module.exports = new OrderBook();
