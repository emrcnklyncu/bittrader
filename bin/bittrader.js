/**
 * Module dependencies.
 */
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const flash = require('express-flash');
const cron = require('node-cron');
const chalk = require('chalk');
const path = require('path');
const pug = require('pug');
const crypto = require('crypto');
const rsi = require('technicalindicators').RSI;
const bb = require('technicalindicators').BollingerBands;
const package = require('../package.json');

/**
 * Import libraries.
 */
const util = require('../libraries/util')();
const database = require('../libraries/database')();
const client = require('../libraries/client')(database.getConfig('key'), database.getConfig('secret'));
const constant = require('../libraries/constant');

/**
 * Set timezone.
 */
process.env.TZ = database.getConfig('timezone');

/**
 * Create Express app.
 */
const app = express();

/**
 * Express configuration.
 */
app.set('host', process.env.HOST || '0.0.0.0');
app.set('port', process.env.PORT || database.getConfig('port') || 3000);
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, '..', 'views'));
app.use('/', express.static(path.join(__dirname, '..', 'public'), {maxAge: 31557600000}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(flash());
app.use(session({
  resave: true,
  saveUninitialized: true,
  secret: constant.SESSION_SECRET,
  cookie: {maxAge: 1209600000}, // two weeks in milliseconds
}));
app.use((req, res, next) => {
  var auth = req.cookies['auth'];
  if (auth) {
    if ('/logout' == req.path) {
      res.clearCookie('auth');
      return res.redirect('/login');
    }
    let decipher = crypto.createDecipher(constant.SESSION_ALGORITHM, constant.SESSION_SECRET);
    let usernameAndPassword = decipher.update(auth, 'hex', 'utf8') + decipher.final('utf8');
    if ((database.getConfig('username') + database.getConfig('password')) == usernameAndPassword) {
      if ('/login' == req.path) return res.redirect('/');
      return next();
    }
  }
  if ('/login' != req.path) return res.redirect('/login');
  return next();
});

/**
 * Web app methods.
 */
app.locals.fn = {
  version: package.version,
  description: package.description,
  username: database.getConfig('username'),
  timeToDate : util.timeToDate,
  formatMoney : util.formatMoney,
  calculateGainOrLoss: function (buytrx, selltrx) {
    if (buytrx && !selltrx) {
      let expense = (Math.abs(Number(buytrx.price)) * Math.abs(Number(buytrx.amount))) + Math.abs(Number(buytrx.fee)) + Math.abs(Number(buytrx.tax));
      return {expense: expense};
    } else if (buytrx && selltrx) {
      let expense = (Math.abs(Number(buytrx.price)) * Math.abs(Number(buytrx.amount))) + Math.abs(Number(buytrx.fee)) + Math.abs(Number(buytrx.tax));
      let income = Math.abs(Number(selltrx.price)) * Math.abs(Number(selltrx.amount));
      let gainOrLoss = income - expense;
      return {expense: expense, income: income, gainOrLoss: gainOrLoss};
    }
  }
};

/**
 * Methods.
 */
let writePairs = async function(now) {
  let pairs = [];
  try {
    pairs = await client.getPair(database.getConfig('denominator'));
  } catch (e) {
    console.error(`${chalk.red.bold('error: an error was encountered by api.')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    return;
  }
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
};
let removePairs = async function(now) {
  let time = 21 * 24 * 60 * 60 * 1000;//21 days
  database.removePairs(now - time);
};
let getPairs = async function(now, numerator, limit, period) {
  let pairs = database.getPairs(database.getConfig('denominator'), now.getMinutes(), limit);
  if (pairs.length != limit) return [];
  let res = util.arrayToObject(pairs)[numerator];
  if (period) {
    let pres = [];
    for (i = limit - 1; i >= 0; i = i - period) 
      pres.unshift(res[i]);
    return pres;
  }
  return res;
};
let writeSignals = async function(now) {
  for (p in constant.PERIODS) {
    let period = constant.PERIODS[p];
    for (n in constant.ACCEPTABLE_NUMERATORS) {
      let numerator = constant.ACCEPTABLE_NUMERATORS[n];
      let pairs = await getPairs(now, numerator, period * 20, period);
      if (pairs.length == 20) {
        let last = pairs[19];
        let rsi = await calculateRSI(pairs.slice(4, 20));
        let bb = await calculateBB(pairs.slice(0, 20));
        if (last && rsi[0] && rsi[1] && bb[0]) {
          let buysignal = false;
          let sellsignal = false;
          if (rsi[0] <= 30 && rsi[1] > 30 && bb[0].lower >= last) {//signal for buy
            buysignal = true;
          } else if (rsi[0] >= 70 && rsi[1] < 70 && bb[0].upper <= last) {//signal for sell
            sellsignal = true;
          }
          if (buysignal || sellsignal) {
            database.pushSignal({
              denominator: database.getConfig('denominator'),
              numerator: numerator,
              last: last,
              rsi0: rsi[0],
              rsi1: rsi[1],
              bblower: bb[0].lower,
              bbupper: bb[0].upper,
              buysignal: buysignal,
              sellsignal: sellsignal,
              period: period,
              time: now.getTime()
            });
          }
        }
      }
    }
  }
};
let getSignals = async function(now, limit) {
  return database.getSignals(database.getConfig('denominator'), now, limit);

};
let calculateRSI = async function(pairs) {
  //14 & 16 => is required for rsi calculation
  if (pairs.length == 16) {
    return rsi.calculate({values: pairs, period: 14});
  } else {
    return false;
  }
};
let calculateBB = async function(pairs) {
  //20 => is required for bb calculation
  //stdDev => standard deviation 
  if (pairs.length == 20) {
    return bb.calculate({values: pairs, period: 20, stdDev: 2});
  } else {
    return false;
  }
};
let buy = async function(now, numerator) {
  let buy = null;
  /**
   * buy
   */
  try {
    buy = await client.submitMarketOrder(numerator, database.getConfig('denominator'), 'buy', database.getConfig('orderamount'));
  } catch (e) {
    console.error(`${chalk.red.bold('error: an error was encountered by api for buy.')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    console.error(e);
    return;
  }
  /**
   * reconciliation
   */
  let tx = setInterval(async function() {
    try {
      let transactions = await client.getTransactions();
      let result = transactions.find(transaction => transaction.orderId == buy.id);
      if (result) {
        database.pushOrder({ buy: result.orderId, buytrx: result, sell: null, selltrx: null, numerator: result.numeratorSymbol, denominator: result.denominatorSymbol, time: now.getTime()});
        console.log(`${util.formatMoney(result.amount, 4)} ${result.numeratorSymbol}s at a value of ${util.formatMoney(result.price, 4)} were purchased on ${util.timeToDate(result.timestamp)}.`);
      }
      clearInterval(tx);
    } catch (e) {
      console.error(`${chalk.red.bold('error: an error was encountered by api for reconciliation.')}`);
      console.error(`${chalk.red.bold(e.code, e.text)}`);
      console.error(e);
    }
  }, 2500);
};
let sell = async function(now, numerator) {
  let orders = database.getOrders({ sell: null, numerator: numerator });
  for (o in orders) {
    let order = orders[o];
    let sell = null;
    /**
    * sell
    */
    try {
      sell = await client.submitMarketOrder(numerator, database.getConfig('denominator'), 'sell', Math.abs(Number(order.buytrx.amount)));
    } catch (e) {
      console.error(`${chalk.red.bold('error: an error was encountered by api for sell.')}`);
      console.error(`${chalk.red.bold(e.code, e.text)}`);
      console.error(e);
      return;
    }
    /**
     * reconciliation
     */
    let tx = setInterval(async function() {
      try {
        let transactions = await client.getTransactions();
        let result = transactions.find(transaction => transaction.orderId == sell.id);
        if (result) {
          database.updateOrder({buy: order.buy}, {sell: result.orderId, selltrx: result, time: now.getTime()});
          console.log(`${util.formatMoney(result.amount, 4)} ${result.numeratorSymbol}s at a value of ${util.formatMoney(result.price, 4)} were sold on ${util.timeToDate(result.timestamp)}.`);
        }
        clearInterval(tx);
      } catch (e) {
        console.error(`${chalk.red.bold('error: an error was encountered by api for reconciliation.')}`);
        console.error(`${chalk.red.bold(e.code, e.text)}`);
        console.error(e);
      }
    }, 2500);
  }
};
/**
 * Run controller job.
 */
let controller = () => {
  cron.schedule(database.getConfig('expression'), async () => {
    var now = new Date();
    await writePairs(now);
    await removePairs(now);
    await writeSignals(now);
    let signals = await getSignals(now);
    for (s in signals) {
      let signal = signals[s];
      if (signal.buysignal) {
        console.log('---------------------------------------------------');
        console.log(`${signal.numerator}/${signal.last} - ${signal.rsi0},${signal.rsi1} - ${signal.bblower},${signal.bbupper}`);
        console.log(chalk.green.bold(`signal for ${signal.numerator} buy at ${util.timeToDate(signal.time)} in ${signal.period}. period`));
        if (database.getConfig('allowbuy')) await buy(now, signal.numerator);
      } else if (signal.sellsignal) {
        console.log('---------------------------------------------------');
        console.log(`${signal.numerator}/${signal.last} - ${signal.rsi0},${signal.rsi1} - ${signal.bblower},${signal.bbupper}`);
        console.log(chalk.green.bold(`signal for ${signal.numerator} sell at ${util.timeToDate(signal.time)} in ${signal.period}. period`));
        if (database.getConfig('allowsell')) await sell(now, signal.numerator);
      }
    }
  });
};

/**
 * Routes.
 */
app.get('/login', function(req, res) {
  res.render('login', { title: 'Authenticate User' });
});
app.post('/login', function(req, res) {
  let username = req.body.username,
      password = req.body.password;
  if (database.getConfig('username') == username && database.getConfig('password') == password) {
    let cipher = crypto.createCipher(constant.SESSION_ALGORITHM, constant.SESSION_SECRET);
    let auth = cipher.update(username + password, 'utf8', 'hex') + cipher.final('hex');
    res.cookie('auth', auth, {maxAge: 31557600000, httpOnly: true});
    res.redirect('/');
  } else {
    req.flash('error', {text: 'Username or password is incorrect.'});
    res.redirect('/login');
  }
});
app.get('/', async function(req, res) {
  try {
    let balances = await client.getAccountBalance();
    let signals = await getSignals();
    let orders = database.getOrders();
    res.render('dashboard', { title: 'Dashboard', balances: balances, signals: signals, orders: orders });
  } catch(e) {
    console.error(e);
    res.status(500).send('server error');
  }
});
app.get('/ajax', async function(req, res) {
  try {
    let balances = await client.getAccountBalance();
    let signals = await getSignals();
    let orders = database.getOrders();
    res.send(pug.renderFile(path.join(__dirname, '..', 'views', 'dashboard.pug'), { fn: app.locals.fn, title: 'Dashboard', messages: [], balances: balances, signals: signals, orders: orders }));
  } catch(e) {
    console.error(e);
    res.status(500).json('server error');
  }
});

/**
 * Start Express server.
 */
app.listen(app.get('port'), () => {
  console.log('---------------------------------------------------');
  console.log('---------------------------------------------------');
  console.log('%s App is running at http://localhost:%d', chalk.green('✓'), app.get('port'));
  console.log('---------------------------------------------------');
  console.log('---------------------------------------------------');
  controller();
});