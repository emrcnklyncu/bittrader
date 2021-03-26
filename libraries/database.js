const path = require('path');
const low = require('lowdb');
const lowfs = require('lowdb/adapters/FileSync');
const lowadapter = new lowfs('bittrader.json');
const db = low(lowadapter);
const constant = require('./constant');

db.defaults({ config: {
  status: constant.STATUS_BEGINNED,
  denominator: constant.DEFAULT_DENOMINATOR,
  expression: constant.DEFAULT_EXPRESSION,
  stoploss: constant.DEFAULT_STOP_LOSS_RATIO,
  targetgain: constant.DEFAULT_TARGET_GAIN_RATIO,
  orderamount: constant.DEFAULT_ORDER_AMOUNT
}, orders: [], pairs: [] }).write();

module.exports = function() {
  function getConfig(config = null) {
    if (config)
      return db.get(`config.${config}`).value();
    return db.get('config').value();
  };
  function setConfig(config, value) {
    if (config)
      db.set(`config.${config}`, value).write();
  };
  function getPairs(denominator, minute, limit) {
    db.read();
    return db.get('pairs').filter({denominator: denominator, minute: minute}).sortBy('time').reverse().take(limit).value();
  };
  function removePairs(time) {
    db.get('pairs').remove(pair => time > pair.time).write();
  };
  function pushPair(pair) {
    db.get('pairs').push(pair).write();
  };

  return {
    getConfig,
    setConfig,
    getPairs,
    removePairs,
    pushPair,
  };
};