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
let buy = async function() {
  
};
let sell = async function() {

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
    let rsi = await checkRSI(pairs.slice(0, 16));
    let bb = await checkBB(pairs.slice(0, 20));
    if (pairs[0] && rsi[0] && rsi[1] && bb[0]) {
      if (rsi[0] < 30 && rsi[1] >= 30 && bb[0].lower > pairs[0]) {//signal for buy
        console.log(chalk.green.bold(`signal for ${numerator} buy`));
        await buy();
      } else if (rsi[0] > 70 && rsi[1] <= 70 && bb[0].upper < pairs[0]) {//signal for sell
        console.log(chalk.red.bold(`signal for ${numerator} sell`));
        await sell();
      }
    }
  }
});