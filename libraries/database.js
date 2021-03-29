const path = require('path');
const low = require('lowdb');
const lowfs = require('lowdb/adapters/FileSync');
const lowadapter = new lowfs('bittrader.json');
const db = low(lowadapter);
const constant = require('./constant');

db.defaults({ config: {
  status: constant.STATUS_BEGINNED,
  username: constant.DEFAULT_USERNAME, 
  password: constant.DEFAULT_PASSWORD, 
  port: constant.DEFAULT_PORT,
  timezone: constant.DEFAULT_TIMEZONE,
  denominator: constant.DEFAULT_DENOMINATOR,
  expression: constant.DEFAULT_EXPRESSION,
  orderamount: constant.DEFAULT_ORDER_AMOUNT,
  allowbuy: false, 
  allowsell: false
}, signals: [], orders: [], pairs: [] }).write();

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
  function getSignals(denominator, now, limit) {
    db.read();
    if (now)
      return db.get('signals').filter({denominator: denominator, time: now}).sortBy('time').reverse().take(limit || 20).value();
    return db.get('signals').filter({denominator: denominator}).sortBy('time').reverse().take(limit || 20).value();
  };
  function pushSignal(signal) {
    db.get('signals').push(signal).write();
  };
  function getPairs(denominator, minute, limit) {
    db.read();
    return db.get('pairs').filter({denominator: denominator, minute: minute}).sortBy('time').reverse().take(limit).reverse().value();
  };
  function removePairs(time) {
    db.get('pairs').remove(pair => time > pair.time).write();
  };
  function pushPair(pair) {
    db.get('pairs').push(pair).write();
  };
  function getOrders(where) {
    db.read();
    if (where) return db.get('orders').filter(where).sortBy('buy').reverse().value();
    return db.get('orders').sortBy('buy').reverse().value();
  };
  function pushOrder(order) {
    db.get('orders').push(order).write();
  };
  function updateOrder(where, order) {
    db.get('orders').find(where).assign(order).write();
  };

  return {
    getConfig,
    setConfig,
    getSignals,
    pushSignal,
    getPairs,
    removePairs,
    pushPair,
    getOrders,
    pushOrder,
    updateOrder
  };
};