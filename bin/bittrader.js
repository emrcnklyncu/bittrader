/**
 * Module dependencies.
 */
const cron = require('node-cron');
const rsi = require('technicalindicators').RSI;
const bb = require('technicalindicators').BollingerBands;

/**
 * Import libraries.
 */
const util = require('../libraries/util')();
const database = require('../libraries/database')();
const client = require('../libraries/client')(database.getConfig('key'), database.getConfig('secret'));

/**
 * Methods.
 */
let writePairs = async function(now) {
  try {
    let pairs = await client.getPair(database.getConfig('denominator'));
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
  } catch (e) {
    console.log(e);
  }
};
let checkRSI = async function(now, numerator) {
  //14 & 16 => is required for rsi calculation
  let pairs = database.getPairs(now.getMinutes(), 16);
  if (pairs.length == 16) {
    return rsi.calculate({values: util.arrayToObject(pairs)[numerator], period: 14});
  } else {
    return false;
  }
};
let checkBB = async function(now, numerator) {
  //20 => is required for bb calculation
  //stdDev => standard deviation 
  let pairs = database.getPairs(now.getMinutes(), 20);
  if (pairs.length == 20) {
    return bb.calculate({values: util.arrayToObject(pairs)[numerator], period: 20, stdDev: 2});
  } else {
    return false;
  }
};

/**
 * Run controller job.
 */
cron.schedule(database.getConfig('expression'), async () => {
  var now = new Date();
  await writePairs(now);
  let rsi = await checkRSI(now, 'XRP');
  let bb = await checkBB(now, 'XRP');
  console.info('RSI Calculation: ', rsi);
  console.info('BB Calculation: ', bb);
});