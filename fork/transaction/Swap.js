var globals = require("./../../globals");

// _POLONIEX_, _BUY_, new Deal(...), new Shift(...), bill, top.bids, top.asks
module.exports = function(name, rule, deal, shift, bill, bids, asks) {
	this.name = name;
	this.rule = rule;
	this.type = (function() {
		switch(rule) {
			case globals.BUY:  return globals.BID;
			case globals.SELL: return globals.ASK;
		}
	})();
	this.deal = deal;
	this.shift = shift;
	this.bill = bill;
	this.commitDate = null; // new Date().getTime()
	this.fail = null;
	this.commit = function() {
		this.commitDate = new Date().getTime();
	};
	this.bids = bids;
	this.asks = asks;
};