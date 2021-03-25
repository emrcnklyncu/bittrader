const path = require('path');
const low = require('lowdb');
const lowfs = require('lowdb/adapters/FileSync');
const lowadapter = new lowfs('./bittrader.json');
const db = low(lowadapter);

db.defaults({ config: {}, pairs: [] }).write();

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
  function getPairs(minute, limit) {
    db.read();
    return db.get('pairs').sortBy('time').reverse().take(limit).value();
    //return db.get('pairs').filter({minute: minute}).sortBy('time').reverse().take(limit).value();
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