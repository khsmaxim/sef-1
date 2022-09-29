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
