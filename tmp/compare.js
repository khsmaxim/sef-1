var compare = function(master, pair) {
  var slave, diff, id, min;
  const [majorCoin, minorCoin] = globals.pairs.keys(pair);
  var masterPair = master.top100[pair];
  // console.info('----------------------', '('+majorCoin+','+minorCoin+')');
  // console.info('MASTER > ', master.name, master.top100[pair].asks[0], master.top100[pair].bids[0]);
  logs.stat.data.total++;
  for (var name in stocks.data) {
    slave = stocks.data[name];
    if (master.name == slave.name) continue;
    var slavePair = slave.top100[pair];
    if (slavePair.locked) {
      logs.stat.data.compare[master.name][slave.name].out++;
      continue;
    }
    logs.stat.data.compare[master.name][slave.name].in++;

    // -------------------------------------
    //                       Master  Slave
    // 1] BID (Покупаю за)    8570    8590
    // 2] ASK (Продаю за)     8580    8560
    // -------------------------------------

    // console.info('------------------------------', 'master['+master.name+'].SELL', '/', 'slave['+master.name+'].BUY');
    // 1] find diff > 0 to allow SELL on MASTER and BUY on SLAVE
    diff = Number(masterPair.bids[0][0]) - Number(slavePair.asks[0][0]);
    if (diff > 0) {
      cID++;
      logs.ob.add(`[${cID}]`);
      logs.ob.add(`[SELL(${master.name}) ${Number(masterPair.bids[0][0])} ${Number(masterPair.bids[0][1])}]`);
      logs.ob.add(`[BUY(${slave.name}) ${Number(slavePair.asks[0][0])} ${Number(slavePair.asks[0][1])}]`);
      csv.ob.add(`[${cID}]`);
      csv.ob.add(`${master.name}:SELL`);
      csv.ob.add(`Price: ${Number(masterPair.bids[0][0])} ${majorCoin}`);
      csv.ob.add(`Amount: ${Number(masterPair.bids[0][1])} ${minorCoin}`);
      csv.ob.add(`${slave.name}:BUY`);
      csv.ob.add(`Price: ${Number(slavePair.asks[0][0])} ${majorCoin}`);
      csv.ob.add(`Amount: ${Number(slavePair.asks[0][1])} ${minorCoin}`);
      csv.ob.add(`diff:${diff}`);
      logs.stat.data.diff++;
      if (masterPair.swap.SELL) logs.stat.data.inswap[master.name].sell++;
      if (slavePair.swap.BUY) logs.stat.data.inswap[slave.name].buy++;
      // if no transactions into Master SELL and Slave BUY
      if (!(masterPair.swap.SELL && slavePair.swap.BUY)) {
        // take min value from 2 stocks minorCoins to make transaction min value on both side
        min = Math.min(Number(masterPair.bids[0][1]), Number(slavePair.asks[0][1])); // e.g. BTC
        // calc and check enought money for:
        var sellCash = wallet.diff(master.name, minorCoin);
        var sellPrice = Number(masterPair.bids[0][0]);
        var sellAmount = min; // SELL on Master stock (minorCoin e.g. BTC);
        var sellEnought = sellCash >= sellAmount;
        // if not enought money in wallet to sell (e.g. BTC)
        if (!sellEnought) {
          // sell = wallet min (e.g. BTC)
          sellAmount = sellCash;
          sellEnought = sellAmount > 0;
          logs.stat.data.cashout[minorCoin]++;
        }
        var buyCash  = wallet.diff(slave.name, majorCoin);
        var buyPrice = Number(slavePair.asks[0][0]);
        var buyAmount = sellAmount * buyPrice; // BUY on Slave stock (majorCoin e.g. USD);
        var buyEnought = buyCash >= buyAmount;
        // if not enought money in wallet (e.g. USD) to buy (e.g. BTC)
        if (!buyEnought) {
          // buy = wallet min (e.g. USD)
          buyAmount = buyCash;
          // sell = based on buy min
          sellAmount = buyAmount / buyPrice;
          buyEnought = buyAmount > 0;
          logs.stat.data.cashout[majorCoin]++;
        }
        csv.ob.add(`SELL: ${sellAmount} ${minorCoin}`);
        csv.ob.add(`BUY: ${buyAmount} ${majorCoin}`);
        if (!sellEnought) output.once('NOCASH_'+master.name.toUpperCase()+'_'+minorCoin, 'Not enought money');
        if (!buyEnought) output.once('NOCASH_'+slave.name.toUpperCase()+'_'+majorCoin, 'Not enought money');
        if (sellEnought && buyEnought) { // SELL && BUY
          var masterDeal = new Deal( // amount, price, trade, fee, reserved
              new Currency(-sellAmount, minorCoin),
              new Currency(sellPrice, majorCoin),
              new Currency(sellAmount * sellPrice, majorCoin),
              new Fee(sellAmount * sellPrice * master.fee.maker / 100, majorCoin, master.fee.maker),
              new Currency(sellAmount, minorCoin));
          var slaveDeal = new Deal( // amount, price, trade, fee, reserved
              new Currency(sellAmount, minorCoin),
              new Currency(buyPrice, majorCoin),
              new Currency(-sellAmount * buyPrice, majorCoin),
              new Fee(sellAmount * buyPrice * slave.fee.taker / 100, majorCoin, slave.fee.taker),
              new Currency(buyAmount, majorCoin));
          var profit = new Profit( // trade, fee, currency
              masterDeal.trade.value + slaveDeal.trade.value,
              masterDeal.fee.value + slaveDeal.fee.value,
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
            var masterShift = new Shift(
                new ShiftValue(minorCoin, wallet.diff(master.name, minorCoin), 0),
                new ShiftValue(majorCoin, wallet.diff(master.name, majorCoin), 0));
            var slaveShift = new Shift(
                new ShiftValue(majorCoin, wallet.diff(slave.name, majorCoin), 0),
                new ShiftValue(minorCoin, wallet.diff(slave.name, minorCoin), 0));
            masterPair.swap.SELL = new Swap(master.name, globals.SELL, masterDeal, masterShift, masterPair.bids[0]);
            slavePair.swap.BUY = new Swap(slave.name, globals.BUY, slaveDeal, slaveShift, slavePair.asks[0]);
            var reserve1 = new Reserve(master.name, minorCoin, sellAmount);
            var reserve2 = new Reserve(slave.name, majorCoin, buyAmount);
            wallet.reserve(reserve1);
            wallet.reserve(reserve2);
            process.send({
              'command': 'reserve',
              'data': {
                'list': [reserve1, reserve2]
              }
            });
            var trans = new Transaction(majorCoin, minorCoin, masterPair.swap.SELL, slavePair.swap.BUY, profit);
            send(trans, master, slave);
          }
        }
      }
      logs.ob.flush();
      csv.ob.flush();
    }

    // console.info('------------------------------', 'master['+master.name+'].BUY', '/', 'slave['+master.name+'].SELL');
    // 2] find diff > 0 to allow BUY on MASTER and SELL on SLAVE
    diff = Number(slavePair.bids[0][0]) - Number(masterPair.asks[0][0]);
    if (diff > 0) {
      cID++;
      logs.ob.add(`[${cID}]`);
      logs.ob.add(`[BUY(${master.name}) ${Number(masterPair.asks[0][0])} ${Number(masterPair.asks[0][1])}]`);
      logs.ob.add(`[SELL(${slave.name}) ${Number(slavePair.bids[0][0])} ${Number(slavePair.bids[0][1])}]`);
      csv.ob.add(`[${cID}]`);
      csv.ob.add(`${master.name}:BUY`);
      csv.ob.add(`Price: ${Number(masterPair.asks[0][0])} ${majorCoin}`);
      csv.ob.add(`Amount: ${Number(masterPair.asks[0][1])} ${minorCoin}`);
      csv.ob.add(`${slave.name}:SELL`);
      csv.ob.add(`Price: ${Number(slavePair.bids[0][0])} ${majorCoin}`);
      csv.ob.add(`Amount: ${Number(slavePair.bids[0][1])} ${minorCoin}`);
      csv.ob.add(`diff:${diff}`);
      logs.stat.data.diff++;
      if (masterPair.swap.BUY) logs.stat.data.inswap[master.name].buy++;
      if (slavePair.swap.SELL) logs.stat.data.inswap[slave.name].sell++;
      // if no transactions into Master BUY and Slave SELL
      if (!(masterPair.swap.BUY && slavePair.swap.SELL)) {
        // take min value from 2 stocks minorCoins to make transaction min value on both side
        min = Math.min(Number(masterPair.asks[0][1]), Number(slavePair.bids[0][1]));  // e.g. BTC
        // calc and check enought money for:
        var sellCash = wallet.diff(slave.name, minorCoin);
        var sellPrice = Number(slavePair.bids[0][0]);
        var sellAmount = min; // SELL on Slave stock (minorCoin e.g. BTC);
        var sellEnought = sellCash >= sellAmount;
        // if not enought money in wallet to sell (e.g. BTC)
        if (!sellEnought) {
          // sell = wallet min (e.g. BTC)
          sellAmount = sellCash;
          sellEnought = sellAmount > 0;
          logs.stat.data.cashout[minorCoin]++;
        }
        var buyCash  = wallet.diff(master.name, majorCoin);
        var buyPrice = Number(masterPair.asks[0][0]);
        var buyAmount = sellAmount * buyPrice; // BUY on Master stock (majorCoin e.g. USD);
        var buyEnought = buyCash >= buyAmount;
        // if not enought money in wallet (e.g. USD) to buy (e.g. BTC)
        if (!buyEnought) {
          // buy = wallet min (e.g. USD)
          buyAmount = buyCash;
          // sell = based on buy min
          sellAmount = buyAmount / buyPrice;
          buyEnought = buyAmount > 0;
          logs.stat.data.cashout[majorCoin]++;
        }
        csv.ob.add(`SELL: ${sellAmount} ${majorCoin}`);
        csv.ob.add(`BUY: ${buyAmount} ${minorCoin}`);
        if (!sellEnought) output.once('NOCASH_'+slave.name.toUpperCase()+'_'+minorCoin, 'Not enought money');
        if (!buyEnought) output.once('NOCASH_'+master.name.toUpperCase()+'_'+majorCoin, 'Not enought money');
        if (sellEnought && buyEnought) { // SELL && BUY
          var masterDeal = new Deal( // amount, price, trade, fee, reserved
              new Currency(sellAmount, minorCoin),
              new Currency(buyPrice, majorCoin),
              new Currency(-sellAmount * buyPrice , majorCoin),
              new Fee(sellAmount * buyPrice * master.fee.taker / 100, majorCoin, master.fee.taker),
              new Currency(buyAmount, majorCoin));
          var slaveDeal = new Deal( // amount, price, trade, fee, reserved
              new Currency(-sellAmount, minorCoin),
              new Currency(sellPrice, majorCoin),
              new Currency(sellAmount * sellPrice, majorCoin),
              new Fee(sellAmount * sellPrice * slave.fee.maker / 100, majorCoin, slave.fee.maker),
              new Currency(sellAmount, minorCoin));
          var profit = new Profit( // trade, fee, currency
              masterDeal.trade.value + slaveDeal.trade.value,
              masterDeal.fee.value + slaveDeal.fee.value,
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
            var masterShift = new Shift(
                new ShiftValue(majorCoin, wallet.diff(master.name, majorCoin), 0),
                new ShiftValue(minorCoin, wallet.diff(master.name, minorCoin), 0));
            var slaveShift = new Shift(
                new ShiftValue(minorCoin, wallet.diff(slave.name, minorCoin), 0),
                new ShiftValue(majorCoin, wallet.diff(slave.name, majorCoin), 0));
            masterPair.swap.BUY = new Swap(master.name, globals.BUY, masterDeal, masterShift, slavePair.bids[0]);
            slavePair.swap.SELL = new Swap(slave.name, globals.SELL, slaveDeal, slaveShift, masterPair.asks[0]);
            var reserve1 = new Reserve(master.name, majorCoin, buyAmount);
            var reserve2 = new Reserve(slave.name, minorCoin, sellAmount);
            wallet.reserve(reserve1);
            wallet.reserve(reserve2);
            process.send({
              'command': 'reserve',
              'data': {
                'list': [reserve1, reserve2]
              }
            });
            var trans = new Transaction(majorCoin, minorCoin, masterPair.swap.BUY, slavePair.swap.SELL, profit);
            send(trans, master, slave);
          }
        }
      }
      logs.ob.flush();
      csv.ob.flush();
    }
  }
};