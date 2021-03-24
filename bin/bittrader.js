/**
 * Module dependencies.
 */
const cron = require('node-cron');
const moment = require('moment');

/**
 * Import libraries.
 */
const util = require('../libraries/util')();
const database = require('../libraries/database')();
const client = require('../libraries/client')(database.getConfig('key'), database.getConfig('secret'));

/**
 * Run controller job.
 */
 cron.schedule('* * * * *', () => {
  console.log('running a task every two minutes', moment().format('MMMM Do YYYY, h:mm:ss a'));
});
/*
cron.schedule(database.getConfig('expression'), async () => {
  try {
    let pairs = await client.getPair(database.getConfig('currency'));
    let data = {};
    for (p in pairs) {
      let pair = pairs[p];
      data[pair.numeratorSymbol + '-' + pair.denominatorSymbol] = pair.last;
    }
    database.savePair(data);
  } catch (e) {

  }
});*/