/**
 * Module dependencies.
 */
const cron = require('node-cron');
const chalk = require('chalk');
const rsi = require('technicalindicators').RSI;
const bb = require('technicalindicators').BollingerBands;

/**
 * Import libraries.
 */
const util = require('../libraries/util')();
const database = require('../libraries/database')();
const client = require('../libraries/client')(database.getConfig('key'), database.getConfig('secret'));
const constant = require('../libraries/constant');

/**
 * Methods.
 */
let writePairs = async function(now) {
  let pairs = [];
  try {
    pairs = await client.getPair(database.getConfig('denominator'));
  } catch (e) {
    console.error(`${chalk.red.bold('error: an error was encountered by api.')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    return;
  }
  let data = {};
  for (p in pairs) {
    let pair = pairs[p];
    data['denominator'] = database.getConfig('denominator');
    data['hour'] = now.getHours();
    data['minute'] = now.getMinutes();
    data['time'] = now.getTime();
    data[pair.numeratorSymbol] = pair.last;
  }
  database.pushPair(data);
};
let removePairs = async function(now) {
  let time = 2 * 24 * 60 * 60 * 1000;//2 days
  database.removePairs(now - time);
};
let getPairs = async function(now, numerator, limit) {
  let pairs = database.getPairs(database.getConfig('denominator'), now.getMinutes(), limit);
  let res = util.arrayToObject(pairs)[numerator];
  return res;
};
let checkRSI = async function(pairs) {
  //14 & 16 => is required for rsi calculation
  if (pairs.length == 16) {
    return rsi.calculate({values: pairs, period: 14});
  } else {
    return false;
  }
};
let checkBB = async function(pairs) {
  //20 => is required for bb calculation
  //stdDev => standard deviation 
  if (pairs.length == 20) {
    return bb.calculate({values: pairs, period: 20, stdDev: 2});
  } else {
    return false;
  }
};
let buy = async function(now, numerator) {
  let buy = null;
  /**
   * buy
   */
  try {
    buy = await client.submitMarketOrder(numerator, database.getConfig('denominator'), 'buy', database.getConfig('orderamount'));
  } catch (e) {
    console.error(`${chalk.red.bold('error: an error was encountered by api for buy.')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    return;
  }
  /**
   * reconciliation
   */
  let tx = setInterval(async function() {
    try {
      let transactions = await client.getTransactions();
      let result = transactions.find(transaction => transaction.orderId == buy.id);
      if (result) {
        database.pushOrder({ buy: result.orderId, buytrx: result, sell: null, selltrx: null, numerator: result.numeratorSymbol, denominator: result.denominatorSymbol, time: now.getTime()});
        console.log(`${util.formatMoney(result.amount, 4)} ${result.numeratorSymbol}s at a value of ${util.formatMoney(result.price, 4)} were purchased on ${util.timeToDate(result.timestamp)}.`);
      }
      clearInterval(tx);
    } catch (error) {
      console.error(`${chalk.red.bold('error: an error was encountered by api for reconciliation.')}`);
      console.error(`${chalk.red.bold(e.code, e.text)}`);
    }
  }, 2500);
};
let sell = async function(now, numerator) {
  let orders = database.getOrders({ sell: null, numerator: numerator });
  for (o in orders) {
    let order = orders[o];
    let sell = null;
    /**
    * sell
    */
    try {
      sell = await client.submitMarketOrder(numerator, database.getConfig('denominator'), 'sell', Math.abs(Number(order.buytrx.amount)));
    } catch (e) {
      console.error(`${chalk.red.bold('error: an error was encountered by api for sell.')}`);
      console.error(`${chalk.red.bold(e.code, e.text)}`);
      return;
    }
    /**
     * reconciliation
     */
    let tx = setInterval(async function() {
      try {
        let transactions = await client.getTransactions();
        let result = transactions.find(transaction => transaction.orderId == sell.id);
        if (result) {
          database.updateOrder({buy: order.buy}, {sell: result.orderId, selltrx: result, time: now.getTime()});
          console.log(`${util.formatMoney(result.amount, 4)} ${result.numeratorSymbol}s at a value of ${util.formatMoney(result.price, 4)} were sold on ${util.timeToDate(result.timestamp)}.`);
        }
        clearInterval(tx);
      } catch (error) {
        console.error(`${chalk.red.bold('error: an error was encountered by api for reconciliation.')}`);
        console.error(`${chalk.red.bold(e.code, e.text)}`);
      }
    }, 2500);
  }
};
/**
 * Run controller job.
 */
cron.schedule(database.getConfig('expression'), async () => {
  var now = new Date();
  await writePairs(now);
  await removePairs(now);
  for (n in constant.ACCEPTABLE_NUMERATORS) {
    let numerator = constant.ACCEPTABLE_NUMERATORS[n];
    let pairs = await getPairs(now, numerator, 20);
    if (pairs.length == 20) {
      let last = pairs[19];
      let rsi = await checkRSI(pairs.slice(4, 20));
      let bb = await checkBB(pairs.slice(0, 20));
      console.log(`${numerator}/${last} - ${rsi[0]},${rsi[1]} - ${bb[0].lower},${bb[0].upper}`);
      if (last && rsi[0] && rsi[1] && bb[0]) {
        if (rsi[0] < 30 && rsi[1] >= 30 && bb[0].lower > last) {//signal for buy
          console.log(chalk.green.bold(`signal for ${numerator} buy`));
          if (database.getConfig('allowbuy')) await buy(now, numerator);
        } else if (rsi[0] > 70 && rsi[1] <= 70 && bb[0].upper < last) {//signal for sell
          console.log(chalk.red.bold(`signal for ${numerator} sell`));
          if (database.getConfig('allowsell')) await sell(now, numerator);
        }
      }
    }
  }
});