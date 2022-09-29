// var debug = typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' '));

const ws = require('ws');
const http = require('http');
const util = require('util');
const url = require( "url" );
const fs = require('fs');
const querystring = require( "querystring" );
const child_process = require('child_process');
const moment = require('moment');
const globals = require("./globals");
const max = require("./plugins/max/package.js");
const bill = require('./api/bill');
const db = require('./api/db');
const cdata = require('./api/cdata');
const Wallet = require('./Wallet');

var decodeParam = function(param) {
  var parse = function(value) {
    if (/^(\d+|\d*\.\d+)$/.test(value)) {
      return parseFloat(value);
    }
    let keywords = {
      'true': true,
      'false': false,
      'null': null,
      'undefined': undefined,
    };
    if (value in keywords) {
      return keywords[value];
    }
    return value;
  };
  var obj = querystring.parse(param);
  var key = Object.keys(obj)[0];
  obj[key] = parse(obj[key]);
  return obj;
};

var params = {
  log: true
};
var args = process.argv.slice(2);
args.forEach(function (value, index, array) {
  Object.assign(params, decodeParam(value));
});

const Output = require("./api/Output");
var output = new Output();

var uniqID = moment().format('YYYYMMDDHHmmss');
var logDir = '';
if (params.log) {
	var logPath = './../cdata/logs/';
	logDir = logPath + uniqID + '/';
	(function() {
		if (!fs.existsSync(logDir)) {
			try {
				fs.mkdirSync(logDir)
			}
			catch (err) {
				output.log(err);
				return null;
			}
		}
	})();
}
output.log('uniqID: '+uniqID);

var p1 = new Promise((resolve, reject) => {
	db.wallet.on('loaded', () => {
		resolve();
	});
});

Promise.all([p1]).then(() => {
	// db.wallet.collection.locked.insert({name: 'CIO', data: {USD: 9991, XRP: 77, EUR: 3}});
	// db.wallet.collection.locked.insert({name: 'poloniex', data: {USD: 50, XRP: 60}});
	// db.wallet.db.saveDatabase();
	// console.info(db.wallet.collection.locked.chain().find({'name': 'pxoloniex'}).limit(1).data());
	// console.info(db.wallet.collection.locked.find({'name': 'pxoloniex'}));

	// setup bill locked data
	var updateBillLockedData = function() {
		var wrc = db.wallet.collection.locked.chain().data();
		// console.info('-----------------');
		// console.info(wrc);
		wrc.forEach((value, index) => {
			if (bill.hasOwnProperty(value.name)) {
				for (var currency in value.data) {
					bill[value.name].locked[currency] = value.data[currency];
				}
			}
		});
	};
	updateBillLockedData();
	// console.info(bill);

	var wallet = new Wallet(bill);

	var childs = {
		data: {},
		status: function() {
			var result = {};
			globals.stocks.pairs.forEach((pairName, ii) => {
				result[pairName] = [];
				for (var stockName in globals.stocks.stocks) {
					var value = false;
					if (globals.stocks.stocks[stockName].pair[pairName] === null) {
						value = null;
					}
					else {
						if (childs.data.hasOwnProperty(pairName)) {
							var index = globals.stocks.order.indexOf(stockName);
							value = childs.data[pairName].stocks[index];
						}
					}
					result[pairName].push(value);
				}
			});
			return {
				stocks: globals.stocks.order,
				pairs: result
			};
		},
		send: {
			billAll: function(except) {
				for (var pairName in childs.data) {
					if (except == childs.data[pairName].child) continue;
					childs.data[pairName].child.send({'command': 'bill', 'data': wallet.bill});
				}
			}
		},
		add: function(child, pair, stocks) {
			if (childs.data.hasOwnProperty(pair)) return;
			child.send({
				'command': 'init',
				'bill': wallet.bill,
				'stocks': stocks,
				'logDir': logDir
			});
			child.on('message', (value) => {
				switch (value.command) {
					case 'reserve': {
						output.log('MESSAGE['+pair+'].reserve', JSON.stringify(value.data.list));
						value.data.list.forEach((value, index) => {
							wallet.reserve(value);
						});
						childs.send.billAll(child);
					}
					break;
					case 'bill': {
						output.log('MESSAGE['+pair+'].bill', JSON.stringify(value.data));
						wallet.update(value.data.name, value.data.shift);
						childs.send.billAll();
					}
					break;
					case 'transaction': {
						output.log('MESSAGE['+pair+'].transaction',
							value.data.master.name + ':' + value.data.master.rule,
							value.data.slave.name + ':' + value.data.slave.rule);
						var transaction = cdata.transactions.insert(value.data);
						if (transaction) {
							wss['/socket/transactions'].sendAll(transaction);
						}
					}
					break;
				}
			});
			child.on('exit', function() {
				output.log('EXITED['+pair+']['+child.pid+']');
				// var ii = childs.data.indexOf(child);
				// if (ii >= 0) childs.data.splice(ii);
				// if (!childs.data.length) {
				//	exitApi();
				// }
				delete childs.data[pair];
				if (exiting) {
					if (max.utils.obj.isEmpty(childs.data)) {
						exitApi();
					}
				}
			});
			childs.data[pair] = {
				'stocks': stocks,
				'child': child
			};
		},
		update: function(pair, stocks) {
			childs.data[pair].stocks = stocks;
			childs.data[pair].child.send({'command': 'stocks', 'data': stocks});
		},
		remove: function(pair) {
			// childs.data[pair].child.kill('SIGKILL');
			childs.data[pair].child.send({'command': 'exit'});
		}
	};

	var logWallet = function() {
		// console.info(util.inspect(wallet.bill, false, null));
		try {
			fs.writeFileSync(logDir + 'wallet.json', JSON.stringify(wallet.bill), { flag: 'w' });
		}
		catch (err) {
			output.log(err);
			return null;
		}
	};

	var exiting = false;
	var exitApi = function() {
		if (params.log) logWallet();
		process.exit();
	};
	var onExit = function() {
		exiting = true;
		if (max.utils.obj.isEmpty(childs.data)) {
			exitApi();
		}
	};
	process
		.on('SIGINT', onExit) // ctrl+c
		.on('SIGTERM', onExit)
		.on('exit', function() {
			// process.kill(process.pid, 'SIGTERM');
		});

	var httpServer = http.createServer((req, res) => {
		res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.10:7115');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
		res.setHeader('Access-Control-Allow-Credentials', true);
		if (req.url == '/') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.write('<html><body><p>SEF available!</p></body></html>');
			res.end();
		}
		else if (req.url == '/kill') {
			exitApi();
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.write(JSON.stringify({ message: "Success"}));
			res.end();
		}
		else if (req.url == '/markets') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			switch (req.method) {
				case 'GET':
					res.write(JSON.stringify(childs.status()));
					res.end();
				break;
				case 'POST':
					var body = '';
					req.on('data', function (data) {
						body += data;
						//// Too much POST data, kill the connection!
						//// 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
						//if (body.length > 1e6) {
						//	req.connection.destroy();
						//}
					});
					req.on('end', function () {
						var response = JSON.parse(body);
						for (var pair in response.pairs) {
							if (!childs.data.hasOwnProperty(pair)) {
								if (response.pairs[pair].some((element, index) => {	return element === true; })) {
									var child = child_process.fork('fork.js', ['pair='+pair, 'log='+params.log]);
									childs.add(child, pair, response.pairs[pair]);
								}
							}
							else {
								if (response.pairs[pair].some((element, index) => {	return element === true; })) {
									childs.update(pair, response.pairs[pair]);
								}
								else {
									childs.remove(pair);
								}
							}
						}
						res.write(JSON.stringify(childs.status()));
						res.end();
					});
				break;
				default:
					res.write('{}');
					res.end();
			}
		}
		else if (req.url == '/wallet/lock') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			switch (req.method) {
				case 'POST':
					var body = '';
					req.on('data', function (data) {
						body += data;
						//// Too much POST data, kill the connection!
						//// 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
						//if (body.length > 1e6) {
						//	req.connection.destroy();
						//}
					});
					req.on('end', function () {
						var response = JSON.parse(body);
						var item;
						var items = db.wallet.collection.locked.find({'name': response.stock});
						if (items.length) {
							item = items[0];
							item.data[response.currency] = response.value;
							db.wallet.db.saveDatabase();
						}
						else {
							item = db.wallet.collection.locked.insert({
								name: response.stock,
								data: {
									[response.currency]: response.value
								}
							});
							db.wallet.db.saveDatabase();
						}
						updateBillLockedData();
						childs.send.billAll();
						res.write(JSON.stringify(item));
						res.end();
						wss['/socket/wallets'].sendAll();
					});
				break;
				default:
					res.write('{}');
					res.end();
			}
		}
		else {
			res.writeHead(409, { 'Content-Type': 'text/plain' });
			res.end('Forbidden');
		}
	});

	// https://github.com/websockets/ws/pull/885
	var wss = {};
	wss['/socket/wallets'] = new (function() {
		var that = this;
		that.server = new ws.Server({noServer: true});
		that.server.on('connection', function(client, req) {
			// const ip = req.connection.remoteAddress;
			// client.on('message', function incoming(message) {
			// 	console.log('received on server: %s', message);
			// });
			that.send(client);
			client.on('close', (code, message) => {
				// console.log('CLOSE', code);
			});
			client.on('error', (err) => {
				output.log(err);
			});
		});
		that.send = function(client) {
			try {
				client.send(JSON.stringify({
					'bill': wallet.bill,
					'stocks': globals.stocks.order,
					'currencies': globals.stocks.currencies
				}));
			}
			catch (err) {
				output.log(err);
			}
		};
		that.sendAll = function () {
			that.server.clients.forEach(function each(client) {
				that.send(client);
			});
		};
	})();

	wss['/socket/transactions'] = new (function() {
		var that = this;
		that.server = new ws.Server({noServer: true});
		that.server.on('connection', function(client, req) {
			// const ip = req.connection.remoteAddress;
			// client.on('message', function incoming(message) {
			// 	console.log('received on server: %s', message);
			// });
			that.send(client, cdata.transactions.last(100));
			client.on('close', (code, message) => {
				// console.log('CLOSE', code);
			});
			client.on('error', (err) => {
				output.log(err);
			});
		});
		that.send = function(client, data) {
			try {
				client.send(JSON.stringify(data));
			}
			catch (err) {
				output.log(err);
			}
		};
		that.sendAll = function(transaction) {
			that.server.clients.forEach(function each(client) {
				that.send(client, [transaction]);
			});
		};
	})();

	httpServer.listen(10081, '127.0.0.10');
	// httpServer.on('connection', (soket) => {});
	httpServer.on('upgrade', (request, socket, head) => {
		const route = url.parse(request.url).pathname;
		if (!wss.hasOwnProperty(route)) {
			socket.destroy();
			return;
		}
		wss[route].server.handleUpgrade(request, socket, head, (client) => {
			wss[route].server.emit('connection', client);
		});
	});

	/* setTimeout(() => {
		console.info('Try to send');
		wss['/socket/wallets'].clients.forEach(function each(client) {
			if (client.readyState === ws.OPEN) {
				try {
					client.send(JSON.stringify(wallet.bill));
				}
				catch (e) {
					console.info(e);
				}
			}
		});
	}, 5000); */
});