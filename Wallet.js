const util = require('util');
const Big = require('big.js');

var Wallet = function (bill) {
	this.bill = bill;
	this.reserve = function(rr) {
		this.bill[rr.stock].reserved[rr.currency] = Number((new Big(this.bill[rr.stock].reserved[rr.currency])).plus(rr.amount).valueOf());
	};
	this.diff = function(stock, currency) {
		return (new Big(this.bill[stock].cash[currency])).minus(this.bill[stock].reserved[currency]).minus(this.bill[stock].locked[currency]);
	};
	this.update = function(stock, shift) {
		for (var currency in shift) {
			this.bill[stock].cash[currency] = Number((new Big(this.bill[stock].cash[currency])).plus(shift[currency]).valueOf());
		}
	};
	this.snapshoot = function(stock) {
		return JSON.parse(JSON.stringify(this.bill[stock]));
	};
};

module.exports = Wallet;