const path = require('path');
const low = require('lowdb');
const lowfs = require('lowdb/adapters/FileSync');
const lowadapter = new lowfs('bittrader.json');
const db = low(lowadapter);
const constant = require('./constant');

/**
 * DB default configs.
 */
let config = {
  status: constant.STATUS_BEGINNED,
  username: constant.DEFAULT_USERNAME, 
  password: constant.DEFAULT_PASSWORD, 
  port: constant.DEFAULT_PORT,
  timezone: constant.DEFAULT_TIMEZONE,
  denominator: constant.DEFAULT_DENOMINATOR,
  numerators: constant.ACCEPTABLE_NUMERATORS,
  amount: constant.DEFAULT_AMOUNT,
  allowbuy: false, 
  allowsell: false
};

/**
 * Set db default values.
 */
db.defaults({ config: config, balances: [], trades: [], signals: []}).write();

/**
 * If db exists, set db default values 
 */
for (const [key, value] of Object.entries(config)) {
  if (!db.has(`config.${key}`).value()) {
    db.set(`config.${key}`, value).write();
  }
};

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
  function hasSignals(type, denominator, numerator, hour = 1) {
    let now = new Date().getTime();
    let buysignal = false;
    let sellsignal = false;
    if ('BUY' == type) buysignal = true;
    if ('SELL' == type) sellsignal = true;
    db.read();
    return db.get('signals').filter({ denominator, numerator, buysignal, sellsignal }).value().filter((signal) => signal.time > now - (hour * 60 * 60 * 1000)).length > 0;
  };
  function getSignals() {
    db.read();
    return db.get('signals').sortBy('time').reverse().take(200).value();
  };
  function pushSignal(signal) {
    db.get('signals').push(signal).write();
  };
  function getBalances() {
    db.read();
    return db.get('balances').value();
  };
  function setBalances(balances) {
    db.set('balances', balances).write();
  };
  function getTrades() {
    db.read();
    return db.get('trades').value();
  };
  function setTrades(trades) {
    db.set('trades', trades).write();
  };

  return {
    getConfig,
    setConfig,
    hasSignals,
    getSignals,
    pushSignal,
    getBalances,
    setBalances,
    getTrades,
    setTrades
  };
};