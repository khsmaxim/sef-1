const querystring = require('querystring');
const util = require('util');
const fs = require('fs');
const Big = require('./plugins/big.js');

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
  log: false,
  standalone: false,
};
var args = process.argv.slice(2);
args.forEach(function (value, index, array) {
  Object.assign(params, decodeParam(value));
});
if (!params.hasOwnProperty('pair')) {
  throw new Error('REQUEST_FAILED');
}

process.pair = params['pair'];

const output = require("./fork/output");

const Logs = require("./fork/Logs");
var logs = new Logs();

const CSV = require("./fork/CSV");
var csv = new CSV();

var globals = require("./globals");
globals.pairs.init([process.pair]);
if (!globals.pairs.hasOwnProperty(globals.APP)) {
  throw new Error(output.message('INIT_FAILED'));
}
output.out('PID:'+process.pid);

const max = require("./plugins/max/package.js");
const Wallet = require('./Wallet');
const Reserve = require('./Reserve');
var stocks = require("./fork/stocks");
var Currency = require("./fork/transaction/Currency");
var Fee = require("./fork/transaction/Fee");
var Profit = require("./fork/transaction/Profit");
var ShiftValue = require("./fork/transaction/ShiftValue");
var Shift = require("./fork/transaction/Shift");
var Deal = require("./fork/transaction/Deal");
var Swap = require("./fork/transaction/Swap");
var Transaction = require("./fork/transaction/Transaction");

var wallet;
var logDir = '';

var p1 = new Promise((resolve, reject) => {
  if (!params.standalone) {
    process.once('message', (value) => {
      // output.out('once.message', value);
      logDir = value.logDir;
      wallet = new Wallet(value.bill);
      value.stocks.forEach((state, index) => {
        if (state) {
          var name = globals.stocks.order[index];
          stocks.add(name);
        }
      });
      resolve();
    });
  }
  else {
    const bill = require('./api/bill');
    logDir = './../cdata/logs/standalone/';
    wallet = new Wallet(bill);
    for (var name in globals.stocks.stocks) stocks.add(name);
    resolve();
  }
});

Promise.all([p1]).then(() => {
  output.out('READY', stocks.names());

  logs.stat.init(stocks.names());

  process.on('message', (value) => {
    // output.out('MESSAGE.'+value.command);
    switch (value.command) {
      case 'bill': {
        wallet.bill = value.data;
      }
      break;
      case 'stocks': {
        value.data.forEach((state, index) => {
          var name = globals.stocks.order[index];
          // add stock if not exist
          if (state) {
            if (!stocks.data.hasOwnProperty(name)) {
              output.out('ADD_STOCK', name);
              stocks.add(name);
              stocks.data[name].on('compare', function(type, pair) {
                switch (type) {
                  case globals.BID: compareBid(this, pair); break;
                  case globals.ASK: compareAsk(this, pair); break;
                }
              });
              stocks.data[name].req.orderBook.subscribeAll();
            }
          }
          // remove stock if exist
          else {
            if (stocks.data.hasOwnProperty(name)) {
              output.out('REMOVE_STOCK', name);
              stocks.data[name].req.orderBook.unsubscribeAll();
              stocks.data[name].busy.register(() => {
                stocks.remove(name);
              });
            }
          }
        });
        output.out('STOCKS', Object.keys(stocks.data));
      }
      break;
      case 'exit': {
        exiting();
      }
      break;
    }
  });

  for (var name in stocks.data) {
    stocks.data[name].on('compare', function(type, pair) {
      switch (type) {
        case globals.BID: compareBid(this, pair); break;
        case globals.ASK: compareAsk(this, pair); break;
      }
    });
    // stocks.data[name].req.orderBook.subscribeAll();
  };

  ////////////////////////////////////////////////////////// TEST

  /*
    stocks.data.poloniex.top[process.pair].locked = false;
    stocks.data.bitstamp.top[process.pair].locked = false;
    // Poloinex BUY / Bitstamp SELL
    stocks.data.poloniex.top[process.pair].asks = [[0.61, 4]];
    stocks.data.poloniex.top[process.pair].bids = [[0.7, 100]];
    stocks.data.bitstamp.top[process.pair].asks = [[0.53, 200]];
    stocks.data.bitstamp.top[process.pair].bids = [[0.62, 5]];
    // Poloinex BUY / Bitstamp SELL
    // stocks.data.poloniex.top[process.pair].asks = [[0.53, 100]];
    // stocks.data.poloniex.top[process.pair].bids = [[0.61, 4]];
    // stocks.data.bitstamp.top[process.pair].asks = [[0.62, 5]];
    // stocks.data.bitstamp.top[process.pair].bids = [[0.7, 200]];
    stocks.data.poloniex.top[process.pair].updated = new Date();
    stocks.data.bitstamp.top[process.pair].updated = new Date();
    compare(stocks.data.poloniex, globals[process.pair]);
  */

  stocks.data.poloniex.top[process.pair].locked = false;
  stocks.data.bitstamp.top[process.pair].locked = false;
  stocks.data.bitfinex.top[process.pair].locked = false;
  stocks.data.poloniex.top[process.pair].updated = new Date();
  stocks.data.bitstamp.top[process.pair].updated = new Date();
  stocks.data.bitfinex.top[process.pair].updated = new Date();

  // BID: Poloinex / ASK: Bitstamp,Bitfinex
  stocks.data.poloniex.top[process.pair].bids = [[10, 1]];
  stocks.data.bitstamp.top[process.pair].asks = [[5, 0.6]];     // [1] diff = 5
  stocks.data.bitfinex.top[process.pair].asks = [[3, 1, 0.7]];  // [0] diff = 7
  compareBid(stocks.data.poloniex, globals[process.pair]);

  // ASK: Poloinex / BID: Bitstamp,Bitfinex
  // stocks.data.poloniex.top[process.pair].asks = [[10, 1]];
  // stocks.data.bitstamp.top[process.pair].bids = [[11, 2]];
  // stocks.data.bitfinex.top[process.pair].bids = [[13, 1, 5]];
  // compareAsk(stocks.data.poloniex, globals[process.pair]);
});

var exiting = function() {
  output.out('PID:'+process.pid, 'EXITING...');
  var busy = [];
  for (var name in stocks.data) {
    stocks.data[name].req.orderBook.unsubscribeAll();
    busy.push(new Promise((resolve, reject) => {
      stocks.data[name].busy.register(() => {
        resolve();
      })
    }));
  };
  // exit from process only when all transactions finished
  Promise.all(busy).then(() => {
    if (params.log) {
      logs.save(logDir, process.pair);
      csv.save(logDir, process.pair);
    }
    process.exit();
  });
};
process
  .on('SIGKILL', exiting)
  .on('SIGHUP', exiting)
  .on('SIGINT', exiting) // ctrl+c
  .on('SIGTERM', exiting)
  .on('exit', function() {
    output.out('PID:'+process.pid, 'EXIT');
  });

var cID = 0;

// -----------------------------------------------------------------------
//                       Master  Slave    |   Master  Slave
// 1] BID (Покупаю за)    8570            |    SELL
// 2] ASK (Продаю за)            8560     |            BUY
// -----------------------------------------------------------------------
var compareBid = function(master, pair) {
  console.info('----------------------------- compareBid');
  const [majorCoin, minorCoin] = globals.pairs.keys(pair);
  var masterPair = master.top[pair];
  var diff, slave, slavePair;
  var slaves = [];
  logs.stat.data.total++;
  for (var name in stocks.data) {
    slave = stocks.data[name];
    if (master.name == slave.name) continue;
    slavePair = slave.top[pair];
    if (slavePair.locked || !slavePair.asks.length) {
      logs.stat.data.compare[master.name][slave.name].out++;
      continue;
    }
    logs.stat.data.compare[master.name][slave.name].in++;
    // 1] find diff > 0 to allow SELL on MASTER and BUY on SLAVE
    diff = masterPair.bid.price(0).minus(slavePair.ask.price(0));
    console.info('SELL.master('+master.name+')('+masterPair.bid.price(0)+') - BUY.slave('+slave.name+')('+slavePair.ask.price(0)+') = '+diff);
    if (diff.gt(0)) {
      var index = 0;
      for (var jj = 0; jj < slaves.length; jj ++) {
        index = jj + 1;
        if (diff.gt(slaves[jj].diff)) {
          index--;
          break;
        }
      }
      slaves.splice(index, 0, {'diff': diff.valueOf(), 'slave': slave});
    }
  }
  // console.log(util.inspect(master), "\n");
  slaves.forEach((value, jj) => { console.log(`[${jj}] ${value.slave.name}(${value.diff})`) });

  var masterAmount = masterPair.bid.amounts(0);
  for (var ii = 0; ii < slaves.length; ii++) {
    console.info(`[${ii}]: ${masterAmount}`);
    if (masterAmount.lte(0)) break;
    slave = slaves[ii].slave;
    slavePair = slave.top[pair];
    var masterPrice = masterPair.bid.price(0);
    var slaveAmount = slavePair.ask.amounts(0);
    var slavePrice = slavePair.ask.price(0);
    cID++;
    logs.ob.add(`${cID}`);
    logs.ob.add(`SELL.${master.name}:(${masterPrice};${masterAmount})`);
    logs.ob.add(`BUY.${slave.name}:(${slavePrice};${slaveAmount})`);
    csv.ob.add(`[${cID}]`);
    csv.ob.add(`${master.name}:SELL`);
    csv.ob.add(`Price: ${masterPrice} ${majorCoin}`);
    csv.ob.add(`Amount: ${masterAmount} ${minorCoin}`);
    csv.ob.add(`${slave.name}:BUY`);
    csv.ob.add(`Price: ${slavePrice} ${majorCoin}`);
    csv.ob.add(`Amount: ${slaveAmount} ${minorCoin}`);
    csv.ob.add(`diff:${slaves[ii].diff}`);
    logs.stat.data.diff++;
    // calc and check enought money for:
    // SELL on Master stock (minorCoin e.g. BTC);
    var sellCash = wallet.diff(master.name, minorCoin);
    var sellPrice = masterPrice;
    // take min value from 2 stocks minorCoins to make transaction min value on both side
    var sellAmount = Big.min(masterAmount, slaveAmount);
    var sellEnought = sellCash.gte(sellAmount);
    // if not enought money in wallet to sell (e.g. BTC)
    if (!sellEnought) {
      // sell = wallet min (e.g. BTC)
      sellAmount = sellCash;
      sellEnought = sellAmount.gt(0);
      logs.stat.data.cashout[minorCoin]++;
    }
    // BUY on Slave stock (majorCoin e.g. USD);
    var buyCash  = wallet.diff(slave.name, majorCoin);
    var buyPrice = slavePrice;
    var buyAmount = sellAmount.times(buyPrice);
    var buyEnought = buyCash.gte(buyAmount);
    // if not enought money in wallet (e.g. USD) to buy (e.g. BTC)
    if (!buyEnought) {
      // buy = wallet min (e.g. USD)
      buyAmount = buyCash;
      // sell = based on buy min
      sellAmount = buyAmount.div(buyPrice);
      buyEnought = buyAmount.gt(0);
      logs.stat.data.cashout[majorCoin]++;
    }
    logs.ob.add(`sell[cash:${sellCash}${minorCoin} price:${sellPrice}${majorCoin} amount:${sellAmount}${minorCoin}]`);
    logs.ob.add(`buy[cash:${buyCash}${majorCoin} price:${buyPrice}${majorCoin} amount:${buyAmount}${majorCoin}]`);
    csv.ob.add(`${master.name}.SELL: ${sellAmount} ${minorCoin} CASH: ${sellEnought}`);
    csv.ob.add(`${slave.name}.BUY: ${buyAmount} ${majorCoin} CASH: ${buyEnought}`);
    if (sellEnought && buyEnought) { // SELL && BUY
      var masterDeal = new Deal( // amount, price, trade, fee, reserved
          new Currency(-sellAmount, minorCoin),
          new Currency(sellPrice, majorCoin),
          new Currency(sellAmount.times(sellPrice), majorCoin),
          new Fee(sellAmount.times(sellPrice).times(master.fee.maker).div(100), majorCoin, master.fee.maker),
          new Currency(sellAmount, minorCoin));
      var slaveDeal = new Deal( // amount, price, trade, fee, reserved
          new Currency(sellAmount, minorCoin),
          new Currency(buyPrice, majorCoin),
          new Currency(-sellAmount.times(buyPrice), majorCoin),
          new Fee(sellAmount.times(buyPrice).times(slave.fee.taker).div(100), majorCoin, slave.fee.taker),
          new Currency(buyAmount, majorCoin));
      var profit = new Profit( // trade, fee, currency
          masterDeal.trade.value.plus(slaveDeal.trade.value),
          masterDeal.fee.value.plus(slaveDeal.fee.value),
          majorCoin);
      // check fees diff right for start transaction
      var checkFee = profit.trade > profit.fee;
      var checkMin = (profit.trade - profit.fee) > globals.MIN.amount(pair);
      logs.ob.add(`FEE:${checkFee}`);
      logs.ob.add(`MIN:${checkMin}`);
      csv.ob.add(`${master.name}.trade(${masterDeal.trade.value} ${masterDeal.trade.name})`)
      csv.ob.add(`${master.name}.fee(${masterDeal.fee.percent}%)=(${masterDeal.fee.value} ${masterDeal.trade.name})`);
      csv.ob.add(`${slave.name}.trade(${slaveDeal.trade.value} ${slaveDeal.trade.name})`);
      csv.ob.add(`${slave.name}.fee(${slaveDeal.fee.percent}%)=(${slaveDeal.fee.value} ${slaveDeal.trade.name})`);
      csv.ob.add(`FEE: trade(${profit.trade}) > fee(${profit.fee}) => ${checkFee}`);
      csv.ob.add(`MIN: profit(${(profit.trade - profit.fee)}) > min(${globals.MIN.amount(pair)}) => ${checkMin}`);
      if (!checkFee) logs.stat.data.feeout++;
      if (!checkMin) logs.stat.data.minout++;
      if (checkFee && checkMin) {
        masterPair.order.SELL++;
        slavePair.order.BUY++;
        var masterShift = new Shift(
          new ShiftValue(minorCoin, wallet.diff(master.name, minorCoin), 0),
          new ShiftValue(majorCoin, wallet.diff(master.name, majorCoin), 0));
        var slaveShift = new Shift(
            new ShiftValue(majorCoin, wallet.diff(slave.name, majorCoin), 0),
            new ShiftValue(minorCoin, wallet.diff(slave.name, minorCoin), 0));
        var masterSwap = new Swap(
          master.name,
          globals.SELL,
          masterDeal,
          masterShift,
          wallet.snapshoot(master.name),
          masterPair.bid.cut(25),
          null);
        var slaveSwap = new Swap(
          slave.name,
          globals.BUY,
          slaveDeal,
          slaveShift,
          wallet.snapshoot(slave.name),
          null,
          slavePair.ask.cut(25));
        var reserve1 = new Reserve(master.name, minorCoin, sellAmount);
        var reserve2 = new Reserve(slave.name, majorCoin, buyAmount);
        wallet.reserve(reserve1);
        wallet.reserve(reserve2);
        if (!params.standalone) {
          process.send({
            'command': 'reserve',
            'data': {
              'list': [reserve1, reserve2]
            }});
        }
        var trans = new Transaction(majorCoin, minorCoin, masterSwap, slaveSwap, profit);
        send(trans, master, slave);
      }
    }
    else {
      if (!sellEnought) {
        output.once('NOCASH_'+master.name.toUpperCase()+'_'+minorCoin, 'Not enought money');
        logs.ob.add(`${master.name}.${minorCoin}:NOCASH`);
      }
      if (!buyEnought) {
        output.once('NOCASH_'+slave.name.toUpperCase()+'_'+majorCoin, 'Not enought money');
        logs.ob.add(`${slave.name}.${majorCoin}:NOCASH`);
      }
    }
    masterAmount = masterAmount.minus(sellAmount);
    logs.ob.flush();
    csv.ob.flush();
  };
};


// -----------------------------------------------------------------------
//                       Master  Slave    |   Master  Slave
// 1] BID (Покупаю за)            8580    |            SELL
// 2] ASK (Продаю за)     8570            |    BUY
// -----------------------------------------------------------------------
var compareAsk = function(master, pair) {
  console.info('----------------------------- compareAsk');
  const [majorCoin, minorCoin] = globals.pairs.keys(pair);
  var masterPair = master.top[pair];
  var diff, slave, slavePair;
  var slaves = [];
  logs.stat.data.total++;
  for (var name in stocks.data) {
    slave = stocks.data[name];
    if (master.name == slave.name) continue;
    slavePair = slave.top[pair];
    if (slavePair.locked || !slavePair.bids.length) {
      logs.stat.data.compare[master.name][slave.name].out++;
      continue;
    }
    logs.stat.data.compare[master.name][slave.name].in++;
    // 2] find diff > 0 to allow BUY on MASTER and SELL on SLAVE
    diff = slavePair.bid.price(0).minus(masterPair.ask.price(0));
    console.info('BUY.master('+master.name+')('+masterPair.ask.price(0)+') - SELL.slave('+slave.name+')('+slavePair.bid.price(0)+') = '+diff);
    if (diff.gt(0)) {
      var index = 0;
      for (var jj = 0; jj < slaves.length; jj ++) {
        index = jj + 1;
        if (diff.gt(slaves[jj].diff)) {
          index--;
          break;
        }
      }
      slaves.splice(index, 0, {'diff': diff.valueOf(), 'slave': slave});
    }
  }
  // console.log(util.inspect(master), "\n");
  slaves.forEach((value, jj) => { console.log(`[${jj}] ${value.slave.name}(${value.diff})`) });

  var masterAmount = masterPair.ask.amounts(0);
  for (var ii = 0; ii < slaves.length; ii++) {
    console.info(`[${ii}]: ${masterAmount}`);
    if (masterAmount.lte(0)) break;
    slave = slaves[ii].slave;
    slavePair = slave.top[pair];
    var masterPrice = masterPair.ask.price(0);
    var slaveAmount = slavePair.bid.amounts(0);
    var slavePrice = slavePair.bid.price(0);
    cID++;
    logs.ob.add(`${cID}`);
    logs.ob.add(`SELL.${slave.name}:(${slavePrice};${slaveAmount})`);
    logs.ob.add(`BUY.${master.name}:(${masterPrice};${masterAmount})`);
    csv.ob.add(`[${cID}]`);
    csv.ob.add(`${slave.name}:SELL`);
    csv.ob.add(`Price: ${slavePrice} ${majorCoin}`);
    csv.ob.add(`Amount: ${slaveAmount} ${minorCoin}`);
    csv.ob.add(`${master.name}:BUY`);
    csv.ob.add(`Price: ${masterPrice} ${majorCoin}`);
    csv.ob.add(`Amount: ${masterAmount} ${minorCoin}`);
    csv.ob.add(`diff:${slaves[ii].diff}`);
    logs.stat.data.diff++;
    // calc and check enought money for:
    // SELL on Slave stock (minorCoin e.g. BTC);
    var sellCash = wallet.diff(slave.name, minorCoin);
    var sellPrice = slavePrice;
    // take min value from 2 stocks minorCoins to make transaction min value on both side
    var sellAmount = Big.min(masterAmount, slaveAmount);
    var sellEnought = sellCash.gte(sellAmount);
    // if not enought money in wallet to sell (e.g. BTC)
    if (!sellEnought) {
      // sell = wallet min (e.g. BTC)
      sellAmount = sellCash;
      sellEnought = sellAmount.gt(0);
      logs.stat.data.cashout[minorCoin]++;
    }
    // BUY on Master stock (majorCoin e.g. USD);
    var buyCash  = wallet.diff(master.name, majorCoin);
    var buyPrice = masterPrice;
    var buyAmount = sellAmount.times(buyPrice);
    var buyEnought = buyCash.gte(buyAmount);
    // if not enought money in wallet (e.g. USD) to buy (e.g. BTC)
    if (!buyEnought) {
      // buy = wallet min (e.g. USD)
      buyAmount = buyCash;
      // sell = based on buy min
      sellAmount = buyAmount.div(buyPrice);
      buyEnought = buyAmount.gt(0);
      logs.stat.data.cashout[majorCoin]++;
    }
    logs.ob.add(`sell[cash:${sellCash}${minorCoin} price:${sellPrice}${majorCoin} amount:${sellAmount}${minorCoin}]`);
    logs.ob.add(`buy[cash:${buyCash}${majorCoin} price:${buyPrice}${majorCoin} amount:${buyAmount}${majorCoin}]`);
    csv.ob.add(`${slave.name}.SELL: ${sellAmount} ${minorCoin} CASH: ${sellEnought}`);
    csv.ob.add(`${master.name}.BUY: ${buyAmount} ${majorCoin} CASH: ${buyEnought}`);
    if (sellEnought && buyEnought) { // SELL && BUY
      var slaveDeal = new Deal( // amount, price, trade, fee, reserved
          new Currency(-sellAmount, minorCoin),
          new Currency(sellPrice, majorCoin),
          new Currency(sellAmount.times(sellPrice), majorCoin),
          new Fee(sellAmount.times(sellPrice).times(slave.fee.maker).div(100), majorCoin, slave.fee.maker),
          new Currency(sellAmount, minorCoin));
      var masterDeal = new Deal( // amount, price, trade, fee, reserved
          new Currency(sellAmount, minorCoin),
          new Currency(buyPrice, majorCoin),
          new Currency(-sellAmount.times(buyPrice), majorCoin),
          new Fee(sellAmount.times(buyPrice).times(master.fee.taker).div(100), majorCoin, master.fee.taker),
          new Currency(buyAmount, majorCoin));
      var profit = new Profit( // trade, fee, currency
          masterDeal.trade.value.plus(slaveDeal.trade.value),
          masterDeal.fee.value.plus(slaveDeal.fee.value),
          majorCoin);
      // check fees diff right for start transaction
      var checkFee = profit.trade > profit.fee;
      var checkMin = (profit.trade - profit.fee) > globals.MIN.amount(pair);
      logs.ob.add(`FEE:${checkFee}`);
      logs.ob.add(`MIN:${checkMin}`);
      csv.ob.add(`${master.name}.trade(${masterDeal.trade.value} ${masterDeal.trade.name})`)
      csv.ob.add(`${master.name}.fee(${masterDeal.fee.percent}%)=(${masterDeal.fee.value} ${masterDeal.trade.name})`);
      csv.ob.add(`${slave.name}.trade(${slaveDeal.trade.value} ${slaveDeal.trade.name})`);
      csv.ob.add(`${slave.name}.fee(${slaveDeal.fee.percent}%)=(${slaveDeal.fee.value} ${slaveDeal.trade.name})`);
      csv.ob.add(`FEE: trade(${profit.trade}) > fee(${profit.fee}) => ${checkFee}`);
      csv.ob.add(`MIN: profit(${(profit.trade - profit.fee)}) > min(${globals.MIN.amount(pair)}) => ${checkMin}`);
      if (!checkFee) logs.stat.data.feeout++;
      if (!checkMin) logs.stat.data.minout++;
      if (checkFee && checkMin) {
        slavePair.order.SELL++;
        masterPair.order.BUY++;
        var slaveShift = new Shift(
          new ShiftValue(minorCoin, wallet.diff(slave.name, minorCoin), 0),
          new ShiftValue(majorCoin, wallet.diff(slave.name, majorCoin), 0));
        var masterShift = new Shift(
            new ShiftValue(majorCoin, wallet.diff(master.name, majorCoin), 0),
            new ShiftValue(minorCoin, wallet.diff(master.name, minorCoin), 0));
        var slaveSwap = new Swap(
          slave.name,
          globals.SELL,
          slaveDeal,
          slaveShift,
          wallet.snapshoot(slave.name),
          slavePair.bid.cut(25),
          null);
        var masterSwap = new Swap(
          master.name,
          globals.BUY,
          masterDeal,
          masterShift,
          wallet.snapshoot(master.name),
          null,
          masterPair.ask.cut(25));
        var reserve1 = new Reserve(slave.name, minorCoin, sellAmount);
        var reserve2 = new Reserve(master.name, majorCoin, buyAmount);
        wallet.reserve(reserve1);
        wallet.reserve(reserve2);
        if (!params.standalone) {
          process.send({
            'command': 'reserve',
            'data': {
              'list': [reserve1, reserve2]
            }});
        }
        var trans = new Transaction(majorCoin, minorCoin, masterSwap, slaveSwap, profit);
        send(trans, master, slave);
      }
    }
    else {
      if (!sellEnought) {
        output.once('NOCASH_'+slave.name.toUpperCase()+'_'+minorCoin, 'Not enought money');
        logs.ob.add(`${slave.name}.${minorCoin}:NOCASH`);
      }
      if (!buyEnought) {
        output.once('NOCASH_'+master.name.toUpperCase()+'_'+majorCoin, 'Not enought money');
        logs.ob.add(`${master.name}.${majorCoin}:NOCASH`);
      }
    }
    masterAmount = masterAmount.minus(sellAmount);
    logs.ob.flush();
    csv.ob.flush();
  };
};


var send = function(trans, master, slave) {
  // console.info(trans.slave.deal.fee.value);
  fs.writeFileSync(
    logDir + 'trans_'+cID+'.json',
    JSON.stringify(trans
      // , function(key, value) {
      //   // if (typeof value === 'number') return value.toString();
      //   if (typeof value === 'string') {
      //     console.info('['+key+']')
      //     console.info(value);
      //   }
      //   else console.info(key + '.');
      //   return value; }
    ),
    { flag: 'w' });
  // console.info("\n", 'TRANSACTION > ', util.inspect(trans));
  console.info("\n", 'BILL > ', util.inspect(wallet.bill));
  console.info('---------------------------------------------------------');
  trans.commit();
  master.top[trans.pair.name].order[trans.master.rule]--;
  slave.top[trans.pair.name].order[trans.slave.rule]--;
  master.busy.inject();
  slave.busy.inject();
  return;


  var shiftSuccess = function(swap) {
    var majorCoin = trans.pair.keys[0];
    var minorCoin = trans.pair.keys[1];
    switch (swap.rule) {
      case globals.SELL: {
        swap.shift[majorCoin].after = swap.shift[majorCoin].before + swap.deal.trade.value - (swap.deal.trade.value * swap.deal.fee.percent / 100);
        swap.shift[minorCoin].after = swap.shift[minorCoin].before + swap.deal.amount.value;
      }
      break;
      case globals.BUY: {
        swap.shift[majorCoin].after = swap.shift[majorCoin].before + swap.deal.trade.value - (swap.deal.trade.value * swap.deal.fee.percent / 100);
        swap.shift[minorCoin].after = swap.shift[minorCoin].before + swap.deal.amount.value; // - (swap.deal.amount.value * swap.deal.fee.percent / 100);
      }
      break;
    }
  };

  var shiftFail = function(swap) {
    var majorCoin = trans.pair.keys[0];
    var minorCoin = trans.pair.keys[1];
    swap.shift[majorCoin].after = swap.shift[majorCoin].before;
    swap.shift[minorCoin].after = swap.shift[minorCoin].before;
  };

  var reserveWallet = function(swap) {
    var reserve = new Reserve(swap.name, swap.deal.reserved.name, -swap.deal.reserved.value);
    wallet.reserve(reserve);
    process.send({
      'command': 'reserve',
      'data': {
        'list': [reserve]
      }
    });
  };

  var updateWallet = function(swap) {
    process.send({
      'command': 'bill',
      'data': {
        'name': swap.name,
        'shift': (function() {
          var res = {};
          for(var currency in swap.shift) {
            res[currency] = swap.shift[currency].diff;
          }
          return res;
        })()
      }
    });
  };

  var sendTransaction = function() {
    process.send({
      'command': 'transaction',
      'data': trans
    });
  };

  var p1 = new Promise((resolve, reject) => {
    master.req.order(trans.pair.name, {
      success: function(response) {
        shiftSuccess(trans.master);
        trans.master.commit();
        reserveWallet(trans.master);
        updateWallet(trans.master);
        resolve();
      },
      error: function(error, response) {
        shiftFail(trans.master);
        trans.master.fail = (error.code ? error.code + ':' : '') + error.message;
        trans.master.commit();
        reserveWallet(trans.master);
        reject({'stockName': master.name});
      }
    });
  });

  var p2 = new Promise((resolve, reject) => {
    slave.req.order(trans.pair.name, {
      success: function(response) {
        shiftSuccess(trans.slave);
        trans.slave.commit();
        reserveWallet(trans.slave);
        updateWallet(trans.slave);
        resolve();
      },
      error: function(error, response) {
        shiftFail(trans.slave);
        trans.slave.fail = (error.code ? error.code + ':' : '') + error.message;
        trans.slave.commit();
        reserveWallet(trans.slave);
        reject({'stockName': slave.name});
      }
    });
  });

  Promise.all([p1, p2]).then(
    () => {
      trans.commit();
      // clean for next transaction
      master.top[trans.pair.name].order[trans.master.rule]--;
      slave.top[trans.pair.name].order[trans.slave.rule]--;
      sendTransaction();
      final();
      master.busy.inject();
      slave.busy.inject();
    },
    (data) => {
      // TODO: cancel pair, if not possible then ...
      trans.commit();
      // clean for next transaction
      master.top[trans.pair.name].order[trans.master.rule]--;
      slave.top[trans.pair.name].order[trans.slave.rule]--;
      sendTransaction();
      final();
      master.busy.inject();
      slave.busy.inject();
    });

  var final = function() {
    /* console.info("\n", 'TRANSACTION > ', util.inspect(max.utils.obj.toJSON(trans), false, null));
    console.info("\n", 'BILL > ', util.inspect(wallet.bill, false, null));
    console.info('-----------------------');
    console.info(trans.master.shift.USD.before + trans.slave.shift.USD.before, '=>',
      trans.master.shift.USD.after + trans.slave.shift.USD.after);
    console.info(trans.master.shift.XRP.before + trans.slave.shift.XRP.before, '=>',
      trans.master.shift.XRP.after + trans.slave.shift.XRP.after);
    console.info('-----------------------');
    console.info(trans.master.shift.USD.diff + trans.slave.shift.USD.diff);
    console.info(trans.master.shift.XRP.diff + trans.slave.shift.XRP.diff);
    setTimeout(() => {
      console.info("\n", 'BILL > ', util.inspect(wallet.bill, false, null));
    }, 1000); */
  };
};

