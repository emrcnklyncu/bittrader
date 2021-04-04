const crypto = require("crypto");
const axios = require("axios");
const ccxt = require("ccxt");
const rsi = require('technicalindicators').RSI;
const bb = require('technicalindicators').BollingerBands;
const constant = require("./constant");

module.exports = function (apiKey = null, apiSecret = null) {
  let createExchange = (apiKey = null, apiSecret = null) => {
    if (!apiKey || !apiSecret) return null;
    const exchangeId = "binance",
      exchangeClass = ccxt[exchangeId],
      exchange = new exchangeClass({
        apiKey: apiKey,
        secret: apiSecret,
        timeout: 30000,
        enableRateLimit: true,
      });
    return exchange;
  };

  let exchange = createExchange(apiKey, apiSecret);

  let calculateRSI = async function (lasts) {
    //14 & 16 => is required for rsi calculation
    if (lasts.length == 16) {
      return rsi.calculate({ values: lasts, period: 14 });
    } else {
      return false;
    }
  };

  let calculateBB = async function (lasts, stddev = 2) {
    //20 => is required for bb calculation
    //2 => stddev => standard deviation
    if (lasts.length == 20) {
      return bb.calculate({ values: lasts, period: 20, stdDev: stddev });
    } else {
      return false;
    }
  };

  let getNumeratorBalance = async (numerator) => {
    let balance = await exchange.fetchBalance();
    for (b in balance.info.balances) {
      let asset = balance.info.balances[b].asset;
      if (asset == numerator) return Number.parseFloat(balance.info.balances[b].free, 10);
    }
    return 0;
  };

  let getBalances = async (denominator, apiKey = null, apiSecret = null) => {
    try {
      if (apiKey && apiSecret) exchange = createExchange(apiKey, apiSecret);
      let balance = await exchange.fetchBalance();
      let activeBalances = [];
      for (b in balance.info.balances) {
        let asset = balance.info.balances[b].asset;
        let pair = asset + "/" + denominator;
        let free = Number.parseFloat(balance.info.balances[b].free, 10);
        let money = 0;
        let purchasable = true;
        if (free <= 0) continue;
        if (asset == denominator) {
          money = free;
        } else {
          try {
            let ohlcv = await exchange.fetchOHLCV(pair, "1m", undefined, 1);
            if (ohlcv && ohlcv[0] && ohlcv[0][3]) {
              money = free * ohlcv[0][3];
            }
          } catch (e) {
            purchasable = false;
          }
        }
        activeBalances.push({
          asset,
          pair,
          free,
          money,
          purchasable,
          salable: money > 10,
        });
      }
      return activeBalances;
    } catch (e) {
      throw e;
    }
  };

  let getSignals = async (denominator, numerators, timeframe, inHour, periods, stddev = 2, rsilow = 30, rsiupper = 70) => {
    let time = new Date().getTime();
    let signals = [];
    for (n in numerators) {
      let numerator = numerators[n];
      let pair = numerator + "/" + denominator;
      let ohlcv = await exchange.fetchOHLCV(pair, timeframe, undefined, 1000);
      for (p in periods) {
        let period = periods[p];
        if (period * 20 * inHour <= ohlcv.length) {
          let lasts = [];
          let times = [];
          for (o = ohlcv.length - 1; o >= ohlcv.length - period * 20 * inHour; o = o - period * inHour) {
            lasts.unshift(ohlcv[o][3]);
            times.unshift(ohlcv[o][0]);
          }
          if (lasts.length == 20) {
            let last = lasts[19];
            let rsi = await calculateRSI(lasts.slice(4, 20));
            let bb = await calculateBB(lasts.slice(0, 20), stddev);
            if (last && rsi && rsi[0] && rsi[1] && bb && bb[0] && bb[0].lower && bb[0].upper) {
              let buysignal = false;
              let sellsignal = false;
              let rsipre = rsi[0];
              let rsilast = rsi[1];
              let bblower = bb[0].lower;
              let bbupper = bb[0].upper;
              if (rsipre <= rsilow && rsilast > rsilow && bblower >= last) {
                buysignal = true;
              } else if (rsipre >= rsiupper && rsilast < rsiupper && bbupper <= last) {
                sellsignal = true;
              }
              if (buysignal || sellsignal) {
                signals.push({
                  denominator, numerator, pair, timeframe, inHour, period, stddev, rsilow, rsiupper, last, rsipre, rsilast, bblower, bbupper, buysignal, sellsignal, time
                });
              }
            }
          }
        }
      }
    }
    //console.log(new Date().getTime() - time);
    return signals;
  };

  let getSignalsFor3Mins = async (denominator, numerators) => {
    return getSignals(denominator, numerators, "3m", 20, [1, 2], 2, 30, 70);
  };

  let getSignalsFor5Mins = async (denominator, numerators) => {
    return getSignals(denominator, numerators, "5m", 12, [1, 2, 3, 4], 1.9, 31, 70);
  };

  let getSignalsFor15Mins = async (denominator, numerators) => {
    return getSignals(denominator, numerators, "15m", 4, [1, 2, 3, 4, 6, 8, 10, 12], 1.8, 32, 70);
  };

  let getSignalsFor30Mins = async (denominator, numerators) => {
    return getSignals(denominator, numerators, "30m", 2, [1, 2, 3, 4, 6, 8, 10, 12, 24], 1.7, 33, 70);
  };

  let getSignalsFor1Hour = async (denominator, numerators) => {
    return getSignals(denominator, numerators, "1h", 1, [1, 2, 3, 4, 6, 8, 10, 12, 24], 1.6, 34, 70);
  };

  let buy = async (signal, amount) => {
    let balance = getNumeratorBalance(signal.denominator);
    if (balance > 0 && balance > amount) {
      await exchange.createMarketBuyOrder(signal.pair, amount / signal.last); 
    }
  };

  let sell = async (signal) => {
    let balance = getNumeratorBalance(signal.numerator);
    if (balance > 0) {
      await exchange.createMarketSellOrder(signal.pair, balance);
    }
  };

  let getTrades = async (denominator, numerators) => {
    let tx = [];
    for (n in numerators) {
      let numerator = numerators[n];
      let symbol = numerator + denominator;
      let pair = numerator + "/" + denominator;
      let trades = await exchange.fetchMyTrades(pair);
      trades.sort((a, b) => b.timestamp - a.timestamp);
      tx.push({symbol, pair, trades});
    }
    return tx;
  };

  return {
    getBalances,
    getSignalsFor3Mins,
    getSignalsFor5Mins,
    getSignalsFor15Mins,
    getSignalsFor30Mins,
    getSignalsFor1Hour,
    buy,
    sell,
    getTrades
  };
};
