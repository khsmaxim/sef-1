var Bitstamp = require("./stocks/Bitstamp");
var Poloniex = require("./stocks/Poloniex");
var Bitfinex = require("./stocks/Bitfinex");

const classes = {
	bitstamp: () => { return new Bitstamp() },
	poloniex: () => { return new Poloniex() },
	bitfinex: () => { return new Bitfinex() }
};

var Stocks = new (function () {
	this.data = {};
	this.add = function(name) {
		if (this.data.hasOwnProperty(name)) return;
		this.data[name] = classes[name]();
	};
	this.remove = function(name) {
		if (!this.data.hasOwnProperty(name)) return;
		this.data[name] = null;
		delete this.data[name];
	};
	this.names = function() {
		return Object.keys(this.data);
	};
	return this;
})();

module.exports = Stocks;