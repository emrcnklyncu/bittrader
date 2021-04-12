const crypto = require("crypto");
const axios = require("axios");
const ccxt = require("ccxt");
const rsi = require('technicalindicators').RSI;
const bb = require('technicalindicators').BollingerBands;
const database = require('./database')();
const util = require('./util')();
const constant = require("./constant");

const ruler = [
  {stddev: 2, rsilow: 30, rsiupper: 70},
  {stddev: 1.9, rsilow: 31, rsiupper: 70},
  {stddev: 1.8, rsilow: 32, rsiupper: 70},
  {stddev: 1.7, rsilow: 33, rsiupper: 70},
  {stddev: 1.6, rsilow: 34, rsiupper: 70},
  {stddev: 1.5, rsilow: 35, rsiupper: 70},
];

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

  let getRuler = (denominator, numerator, hour = 6) => {
    for (r in ruler) {
      if (database.hasSignals('BUY', denominator, numerator, (r * 1 + 1) * hour))
        return ruler[r];
    }
    return ruler[ruler.length - 1];
  };

  let getSignals = async (denominator, numerators, timeframe, inHour, periods) => {
    let time = new Date().getTime();
    let signals = [];
    for (n in numerators) {
      let numerator = numerators[n];
      let ruler = getRuler(denominator, numerator);
      let stddev = ruler.stddev;
      let rsilow = ruler.rsilow;
      let rsiupper = ruler.rsiupper;
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
              //TODO: let percent = database.getPercentOfTrade('OPEN', denominator, numerator);
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
    console.log('Pass Time for Get Signals: ' + (new Date().getTime() - time) + ' - Start: ' + util.timeToDate(time));
    return signals;
  };

  let getSignalsFor3Mins = async (denominator, numerators) => {
    return await getSignals(denominator, numerators, "3m", 20, [1, 2]);
  };

  let getSignalsFor5Mins = async (denominator, numerators) => {
    return await getSignals(denominator, numerators, "5m", 12, [1, 2, 3, 4]);
  };

  let getSignalsFor15Mins = async (denominator, numerators) => {
    return await getSignals(denominator, numerators, "15m", 4, [1, 2, 3, 4, 6, 8, 10, 12]);
  };

  let getSignalsFor30Mins = async (denominator, numerators) => {
    return await getSignals(denominator, numerators, "30m", 2, [1, 2, 3, 4, 6, 8, 10, 12, 24]);
  };

  let getSignalsFor1Hour = async (denominator, numerators) => {
    return await getSignals(denominator, numerators, "1h", 1, [1, 2, 3, 4, 6, 8, 10, 12, 24]);
  };

  let getTickers = async (denominator, numerators) => {
    let ts = [];
    let tickers = await exchange.fetchTickers();
    for (n in numerators) {
      let numerator = numerators[n];
      let pair = numerator + "/" + denominator;
      if (tickers[pair]) {
        let ticker = tickers[pair];
        ts.push({denominator, numerator, open: ticker.open, close: ticker.close, high: ticker.high, last: ticker.last });
      }
    }
    return ts.sort((a, b) => a.numerator.localeCompare(b.numerator));
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
        let ticker = database.getTicker(denominator, asset);
        if (ticker)
          money = free * ticker.last;
        else
          purchasable = false;
      }
      activeBalances.push({ asset, pair, free, money, purchasable, salable: money > 10 });
    }
    return activeBalances.sort((a, b) => a.asset.localeCompare(b.asset));
  };

  let getTrades = async (denominator, numerators) => {
    let time = new Date().getTime();
    let tx = [];
    for (n in numerators) {
      let numerator = numerators[n];
      let symbol = numerator + denominator;
      let pair = numerator + "/" + denominator;
      let trades = await exchange.fetchMyTrades(pair);
      trades.sort((a, b) => b.timestamp - a.timestamp);
      if (trades.length > 0) {
        let amount = 0;
        let cost = 0
        let buycost = 0
        let sellcost = 0 
        let percent = 0;
        let status = null;
        for (t in trades) {
          let trade = trades[t];
          if ('BUY' == trade.side.toUpperCase()) {
            amount = amount + trade.amount;
            cost = cost - trade.cost;
            buycost = buycost + trade.cost;
          } else if ('SELL' == trade.side.toUpperCase()) {
            amount = amount - trade.amount;
            cost = cost + trade.cost;
            sellcost = sellcost + trade.cost;
          }
        }
        if ('BUY' == trades[0].side.toUpperCase()) {
          status = 'OPEN';
          let ticker = database.getTicker(denominator, numerator);
          if (ticker) {
            sellcost = sellcost + (amount * ticker.last);
            cost = sellcost - buycost;
            percent = (sellcost / buycost * 100) - 100;
          }
        } else if ('SELL' == trades[0].side.toUpperCase()) {
          status = 'CLOSED';
          percent = (sellcost / buycost * 100) - 100;
        }
        tx.push({symbol, pair, numerator, denominator, status, amount, cost, percent, trades});
      }
    }
    console.log('Pass Time for Get Trades: ' + (new Date().getTime() - time) + ' - Start: ' + util.timeToDate(time));
    return tx.sort((a, b) => a.numerator.localeCompare(b.numerator));
  };

  let getMarkets = async (denominator) => {
    let markets = [];
    let allmarkets = await exchange.fetchMarkets();
    for (m in allmarkets) {
      let market = allmarkets[m];
      if ('spot' == market.type && market.spot && market.active && denominator == market.quote)
        markets.push(market);
    }
    return markets;
  };

  let buy = async (signal, amount) => {
    let balance = await getNumeratorBalance(signal.denominator);
    if (balance > 0 && balance > amount) {
      await exchange.createMarketBuyOrder(signal.pair, amount / signal.last); 
    }
  };

  let sell = async (signal) => {
    let balance = await getNumeratorBalance(signal.numerator);
    if (balance > 0) {
      await exchange.createMarketSellOrder(signal.pair, balance);
    }
  };

  return {
    getSignalsFor3Mins,
    getSignalsFor5Mins,
    getSignalsFor15Mins,
    getSignalsFor30Mins,
    getSignalsFor1Hour,
    getTickers,
    getBalances,
    getTrades,
    getMarkets,
    buy,
    sell
  };
};
