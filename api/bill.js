var globals = require("./../globals");

module.exports = (function() {

	var bill = {};
	globals.stocks.order.forEach((stockName, ii) => {
		bill[stockName] = {
			cash: {},
			reserved: {},
			locked: {}
		};
		for (var currencyName in globals.stocks.stocks[stockName].currency) {
			if (globals.stocks.stocks[stockName].currency[currencyName]) {
				bill[stockName].cash[currencyName] = 0;
				bill[stockName].reserved[currencyName] = 0;
				bill[stockName].locked[currencyName] = 0;
			}
		}
	});

	var cash = function(stockName, values) {
		for (var item in values) {
			if (bill[stockName].cash.hasOwnProperty(item)) {
				bill[stockName].cash[item] = values[item];
			}
		}
	}

	cash(globals.POLONIEX, {
		[globals.USD]: 8000,
		[globals.BTC]: 0.5,
		[globals.LTC]: 3.4,
		[globals.XRP]: 0.4, // 7000
	});

	cash(globals.BITSTAMP, {
		[globals.USD]: 1, // 6000,
		[globals.BTC]: 0.3,
		[globals.LTC]: 1.2,
		[globals.XRP]: 5000,
		[globals.EUR]: 2000
	});

	cash(globals.BITFINEX, {
		[globals.USD]: 1.5, // 300,
		[globals.XRP]: 200,
		[globals.JPY]: 0
	});

	return bill;
})();

