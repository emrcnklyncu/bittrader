/**
 * Module dependencies.
 */
 const low = require('lowdb');
 const lowfs = require('lowdb/adapters/FileSync');
 const lowadapter = new lowfs('./db.json');
 const db = low(lowadapter);
 db.defaults({ config: {} }).write();

module.exports = function() {
  function saveConfig(config) {
    db.set('config.key', config.key).write();
    db.set('config.secret', config.secret).write();
    db.set('config.currency', config.currency).write();
    db.set('config.expression', config.expression).write();
  };
  function getOrder(where) {
    return db.get('orders').find(where).value();
  };
  function getOrders(where) {
    if (where) return db.get('orders').filter(where).sortBy('buy').reverse().value();
    return db.get('orders').sortBy('buy').reverse().value();
  };
  function saveOrder(order) {
    order.utc = new Date().getTime();
    db.get('orders').push(order).write();
  };
  function updateOrder(where, order) {
    order._utc = new Date().getTime();
    db.get('orders').find(where).assign(order).write();
  };
  function getPairs() {
    db.read();
    let pair = db.get('pairs').sortBy('utc').reverse().take(1).value();
    let pairs = [];
    let utc = null;
    for (i in pair[0]) {
      if (i == 'utc') utc = pair[0][i];
      else pairs.push({pair: i, last: pair[0][i]});
    }
    for (i in pairs) pairs[i].utc = utc;
    return pairs;
  };
  function savePair(pair) {
    pair.utc = new Date().getTime();
    db.get('pairs').push(pair).write();
  };
  function removePairs(time) {
    db.get('pairs').remove(pair => (new Date().getTime() - time) > pair.utc).write();
  };


  return {
    saveConfig,
    updateOrder,
    getOrder,
    getOrders,
    saveOrder,
    getPairs,
    savePair,
    removePairs
  };
};