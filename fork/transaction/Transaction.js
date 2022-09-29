
// _USD_, _BTC_, new Swap(...), new Swap(...), new Profit(...)
module.exports = function(majorCoin, minorCoin, master, slave, profit) {
	this.initDate = new Date().getTime();
	this.commitDate = null;
	this.pair = {
		name: majorCoin + "_" + minorCoin,
		keys: [majorCoin, minorCoin]
	};
	this.master = master;
	this.slave = slave;
	this.profit = profit;
	this.commit = function() {
		this.commitDate = new Date().getTime();
	};
};