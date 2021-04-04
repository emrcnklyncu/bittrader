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
db.defaults({ config: config, balances: [], signals: [], orders: []}).write();

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
  function getSignals() {
    db.read();
    return db.get('signals').sortBy('time').reverse().take(50).value();
  };
  function pushSignal(signal) {
    db.get('signals').push(signal).write();
  };
  function getOrders(where) {
    db.read();
    if (where) return db.get('orders').filter(where).sortBy('buy').reverse().value();
    return db.get('orders').sortBy('buy').reverse().value();
  };
  function pushOrder(order) {
    db.get('orders').push(order).write();
  };
  function getBalances() {
    db.read();
    return db.get('balances').value();
  };
  function setBalances(balances) {
    db.set('balances', balances).write();
  };

  return {
    getConfig,
    setConfig,
    getSignals,
    pushSignal,
    getOrders,
    pushOrder,
    getBalances,
    setBalances
  };
};