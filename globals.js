
// BUY  / BID  - куплю
// SELL / ASK  - продам

// state: true || false || null (disabled, can't be switched on)
var Stock = function(name, state, currencies, pairs, masterCoins, stockCurrencies, stockPairs) {
  this.name = name;
  this.state = state;
  this.masterCoins = masterCoins;
  this.currency = {};
  currencies.forEach((value, ii) => {
    this.currency[value] = stockCurrencies[value] || null;
  });
  this.pair = {};
  pairs.forEach((value, ii) => {
    this.pair[value] = stockPairs[value] || null;
  });
};

var Stocks = function(currencies, pairs) {
  var stocks = {};
  this.createStock = function(name, state, masterCoins, stockCurrencies, stockPairs) {
    var stock = new Stock(name, state, currencies, pairs, masterCoins, stockCurrencies, stockPairs);
    stocks[name] = stock;
    return stock;
  };
  Object.defineProperty(this, 'currencies', { get: function() { return currencies; }});
  Object.defineProperty(this, 'pairs', { get: function() { return pairs; }});
  Object.defineProperty(this, 'stocks', { get: function() { return stocks; }});
  Object.defineProperty(this, 'order', { get: function() { return Object.keys(this.stocks); }});
  // this.currencies = currencies;
  // this.pairs = pairs;
  // this.stocks = stocks;
};

var Globals = new (function() {
  var that = this;

  this.BID = 'BID';
  this.ASK = 'ASK';

  this.SELL = 'SELL';
  this.BUY  = 'BUY';

  this.APP      = 'app';
  this.POLONIEX = 'poloniex';
  this.BITSTAMP = 'bitstamp';
  this.BITFINEX = 'bitfinex';

  this.USD = 'USD';
  this.EUR = 'EUR';
  this.BTC = 'BTC';
  this.LTC = 'LTC';
  this.ETH = 'ETH';
  this.XRP = 'XRP';
  this.GBP = 'GBP';
  this.JPY = 'JPY';

  this.USD_XRP = 'USD_XRP';
  this.USD_LTC = 'USD_LTC';
  this.USD_BTC = 'USD_BTC';
  this.EUR_XRP = 'EUR_XRP';
  this.BTC_XRP = 'BTC_XRP';
  this.BTC_LTC = 'BTC_LTC';
  this.BTC_GBP = 'BTC_GBP';
  this.BTC_JPY = 'BTC_JPY';

  this.stocks = new Stocks([
      this.USD,
      this.EUR,
      this.BTC,
      this.LTC,
      this.XRP,
      this.GBP,
      this.JPY,
      this.ETH,
    ], [
      this.USD_XRP,
      this.USD_LTC,
      this.USD_BTC,
      this.EUR_XRP,
      this.BTC_XRP,
      this.BTC_LTC,
      this.BTC_GBP,
      this.BTC_JPY,
    ]);

  this.stocks.createStock(this.POLONIEX, true, ['BTC', 'ETH', 'XMR', 'USDT'], {
      [this.USD]: 'USDT',
      [this.BTC]: 'BTC',
      [this.LTC]: 'LTC',
      [this.XRP]: 'XRP',
      [this.ETH]: 'ETH',
    }, {
      [this.USD_XRP]: 'USDT_XRP',
      [this.USD_LTC]: 'USDT_LTC',
      [this.USD_BTC]: 'USDT_BTC',
      [this.BTC_XRP]: 'BTC_XRP',
      [this.BTC_LTC]: 'BTC_LTC',
    });

  this.stocks.createStock(this.BITSTAMP, true, ['BTC', 'ETH', 'XMR', 'USD', 'EUR'], {
      [this.USD]: 'USD',
      [this.EUR]: 'EUR',
      [this.BTC]: 'BTC',
      [this.LTC]: 'LTC',
      [this.XRP]: 'XRP',
      [this.ETH]: 'ETH',
    }, {
      [this.USD_XRP]: 'xrpusd',
      [this.USD_LTC]: 'ltcusd',
      [this.USD_BTC]: 'btcusd',
      [this.EUR_XRP]: 'xrpeur',
      [this.BTC_XRP]: 'xrpbtc',
      [this.BTC_LTC]: 'ltcbtc',
    });

  // BITFINEX
  // BTC – BTC/JPY и BTC/GBP
  // ETH – ETH/EUR, ETH/JPY и ETH/GBP
  // NEO – NEO/EUR, NEO/JPY и NEO/GBP
  // EOS – EOS/EUR, EOS/JPY и EOS/GBP
  // IOTA – IOTA/JPY и IOTA/GBP
  this.stocks.createStock(this.BITFINEX, true, ['BTC', 'ETH', 'USD', 'EUR', 'GBP', 'JPY'], {
      [this.USD]: 'USD',
      [this.EUR]: 'EUR',
      [this.BTC]: 'BTC',
      [this.LTC]: 'LTC',
      [this.XRP]: 'XRP',
      [this.GBP]: 'GBP',
      [this.JPY]: 'JPY',
      [this.ETH]: 'ETH',
    }, {
      [this.USD_XRP]: 'tXRPUSD',
      [this.USD_LTC]: 'tLTCUSD',
      [this.USD_BTC]: 'tBTCUSD',
      [this.EUR_XRP]: 'tXRPEUR',
      [this.BTC_XRP]: 'tXRPBTC',
      [this.BTC_LTC]: 'tLTCBTC',
      [this.BTC_GBP]: 'tGBPBTC',
      [this.BTC_JPY]: 'tJPYBTC',
    });

  this.pairs = new (function() {
    // [this.APP]     : [this.USD_XRP, ...],
    // [this.POLONIEX]: ['USDT_XRP', ...],
    // [this.BITSTAMP]: ['xrpusd', ...],
    this.currencies = [];
    this.init = function(values) { // ['USD_XRP', 'USD_BTC', ...]
      values.forEach((pairValue, pairIndex) => {
        if (that.stocks.pairs.indexOf(pairValue) != -1) {
          if (!this.hasOwnProperty(that.APP)) this[that.APP] = [];
          this[that.APP].push(pairValue);
          this.currencies = this.currencies.concat(
            this.keys(pairValue).filter(function (item) {
              return this.currencies.indexOf(item) < 0;
            }, this));
          that.stocks.order.forEach((stockValue, stockIndex) => {
            if (!this.hasOwnProperty(stockValue)) this[stockValue] = [];
            this[stockValue].push(that.stocks.stocks[stockValue].pair[pairValue]);
          });
        }
      });
    };
    this.keys = function(name) {
      return name.split('_');
    };
    this.alt = function(pair, name) {
      return this[name][this[that.APP].indexOf(pair)];
    };
  })();

  this.MIN = {
    // USD as major coin
    [that.USD_XRP]: 0.1,
    [that.USD_BTC]: 0.1,
    [that.USD_LTC]: 0.1,
    // TODO: use USD value based on current exchange rate
    // BTC as major coin
    [that.BTC_XRP]: 0.00001,
    [that.BTC_LTC]: 0.00001,
    amount: function(pair) {
      return that.MIN[pair];
    }
  };

  this.PRECISIONS = {
    [that.USD]: 2,
    [that.BTC]: 10,
    [that.LTC]: 10,
    [that.XRP]: 10,
    toFixed: function(value, currency) {
      return Number(value).toFixedN(precisions[currency]);
    },
  };

})();

module.exports = Globals;
