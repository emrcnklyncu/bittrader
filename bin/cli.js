#!/usr/bin/env node

/**
 * Module dependencies.
 */
const { program } = require('commander');
const chalk = require('chalk');
const pm2 = require('pm2');
const cron = require('node-cron');
const path = require('path');
const package = require('../package.json');

/**
 * Import libraries.
 */
const util = require('../libraries/util')();
const database = require('../libraries/database')();
const client = require('../libraries/client')();
const constant = require('../libraries/constant');

/**
 * Program actions.
 */
 let connect = async (args) => {
  try {
    await client.getAccountBalance(args.key, args.secret);
  } catch (e) {
    console.error(`${chalk.red.bold('error: cannot access api.')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    return;
  }
  database.setConfig('key', args.key);
  database.setConfig('secret', args.secret);
  console.log(`${chalk.green.bold('✓ api connected.')}`);
  if (constant.STATUS_STARTED == database.getConfig('status')) callproc(null, {name: 'restart'});
  else database.setConfig('status', constant.STATUS_CONNECTED);
};
let config = async (args) => {
  if (args.allowbuy) {
    database.setConfig('allowbuy', true);
  }
  if (args.disallowbuy) {
    database.setConfig('allowbuy', false);
  }
  if (args.allowsell) {
    database.setConfig('allowsell', true);
  }
  if (args.disallowsell) {
    database.setConfig('allowsell', false);
  }
  if (args.denominator) {
    if (!constant.ACCEPTABLE_DENOMINATORS.split(',').includes(args.denominator)) {
      console.error(`${chalk.red.bold('error: not acceptable denominator.')}\nacceptable denominators: ${constant.ACCEPTABLE_DENOMINATORS}`);
      return;
    } else {
      database.setConfig('denominator', args.denominator);
    }
  }
  if (args.expression) {
    if (!cron.validate(args.expression)) {
      console.error(`${chalk.red.bold('error: cron expression is invalid.')}\nplease click for more details of cron expression: ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')}`);
      return;
    } else {
      database.setConfig('expression', args.expression);
    }
  }
  if (args.orderamount) {
    let orderamount = Number.parseFloat(args.orderamount, 10);
    if (Number.isNaN(orderamount) || orderamount < 20) {
      console.error(`${chalk.red.bold('error: order amount must be greather then 20.')}`);
      return;
    } else {
      database.setConfig('orderamount', orderamount);
    }
  }
  if (args.username) {
    database.setConfig('username', args.username);
  }
  if (args.password) {
    database.setConfig('password', args.password);
  }
  if (args.timezone) {
    if (!util.isValidTimeZone(args.timezone)) {
      console.error(`${chalk.red.bold('error: not valid timezone.')}`);
      return;
    } else {
      database.setConfig('timezone', args.timezone);
    }
  }
  if (args.port) {
    let port = Number.parseInt(args.port, 10);
    if (Number.isNaN(port) || port != args.port) {
      console.error(`${chalk.red.bold('error: port must be numeric.')}`);
      return;
    } else {
      database.setConfig('port', port);
    }
  }
  console.log(`${chalk.green.bold('✓ parameters have changed.')}`);
  if (constant.STATUS_STARTED == database.getConfig('status')) callproc(null, {name: 'restart'});
  else database.setConfig('status', constant.STATUS_CONFIGURED);
};
let balance = async (args) => {
  if (!database.getConfig('status') || constant.STATUS_BEGINNED == database.getConfig('status')) {
    console.error(`${chalk.red.bold('error: trader is not yet connected to api. please use the [connect] command first.')}`);
    return;
  }
  try {
    let balances = await client.getAccountBalance(database.getConfig('key'), database.getConfig('secret'));
    console.log(`|${util.padRight('', 44, '-')}|`);
    for (b in balances) {
      let balance = balances[b];
      if (args.hide) {
        let fbalance = Number.parseFloat(balance.balance, 10);
        if (fbalance <= 0.0001) {
          continue;
        }
      }
      console.log(`| ${util.padRight(balance.asset, 5)} | ${util.padRight(balance.assetname, 15)} | ${util.padLeft(util.formatMoney(balance.balance, balance.precision), 16)} |`);
    }
    console.log(`|${util.padRight('', 44, '-')}|`);
  } catch (e) {
    console.error(`${chalk.red.bold('error: an error was encountered by api.')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    return;
  }
};
let order = async (args) => {
  if (!database.getConfig('status') || constant.STATUS_BEGINNED == database.getConfig('status')) {
    console.error(`${chalk.red.bold('error: trader is not yet connected to api. please use the [connect] command first.')}`);
    return;
  }
  try {
    let orders = database.getOrders();
    if (orders && orders.length > 0) {
      console.log(`|${util.padRight('', 128, '-')}|`);
      console.log(`| ${util.padRight('pair', 9)} | ${util.padLeft('price', 16)} | ${util.padLeft('amount', 16)} | ${util.padLeft('expense', 16)} | ${util.padLeft('income', 16)} | ${util.padLeft('gain/loss', 16)} | ${util.padRight('time', 19)} |`);
      console.log(`|${util.padRight('', 128, '-')}|`);
      for (t in orders) {
        let tx = orders[t];
        
        if (tx.buytrx && !tx.selltrx) {
          let expense = (Math.abs(Number(tx.buytrx.price)) * Math.abs(Number(tx.buytrx.amount))) + Math.abs(Number(tx.buytrx.fee)) + Math.abs(Number(tx.buytrx.tax));

          let text = `| ${util.padRight(tx.numeratorSymbol+'/'+tx.denominatorSymbol, 9)} | ${util.padLeft(util.formatMoney(tx.buytrx.price, 4), 16)} | ${util.padLeft(util.formatMoney(Math.abs(tx.buytrx.amount), 4), 16)} | ${util.padLeft(util.formatMoney(expense, 2), 16)} | ${util.padLeft('- not sold -', 16)} | ${util.padLeft('- not sold -', 16)} | ${util.timeToDate(tx.time)} |`;
          console.log(text);
        }
        if (tx.buytrx && tx.selltrx) {
          let expense = (Math.abs(Number(tx.buytrx.price)) * Math.abs(Number(tx.buytrx.amount))) + Math.abs(Number(tx.buytrx.fee)) + Math.abs(Number(tx.buytrx.tax));
          let income = Math.abs(Number(tx.selltrx.price)) * Math.abs(Number(tx.selltrx.amount));
          let gainOrLoss = income - expense;

          let text = `| ${util.padRight(tx.numeratorSymbol+'/'+tx.denominatorSymbol, 9)} | ${util.padLeft(util.formatMoney(tx.selltrx.price, 4), 16)} | ${util.padLeft(util.formatMoney(Math.abs(tx.selltrx.amount), 4), 16)} | ${util.padLeft(util.formatMoney(expense, 2), 16)} | ${util.padLeft(util.formatMoney(income, 2), 16)} | ${gainOrLoss < 0 ? chalk.red.bold(util.padLeft(util.formatMoney(gainOrLoss, 2), 16)) : chalk.green.bold(util.padLeft(util.formatMoney(gainOrLoss, 2), 16))} | ${util.timeToDate(tx.time)} |`;
          console.log(text);
        }
      }
      console.log(`|${util.padRight('', 128, '-')}|`);
    } else {
      console.log(chalk.yellow.bold('no orders.'));
    }
  } catch (e) {
    console.error(`${chalk.red.bold('error: an error was encountered by api.')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    return;
  }
};
let status = async (args) => {
  let text = util.padCenter(database.getConfig('status'), 12);
  console.log(`|${util.padRight('', text.length + 2, '-')}|`);
  console.log(`| ${text} |`);
  console.log(`|${util.padRight('', text.length + 2, '-')}|`);
};
let callproc = async (args, proc) => {
  if (proc && proc._name) proc.name = proc._name;
  if (!database.getConfig('status') || constant.STATUS_BEGINNED == database.getConfig('status')) {
    console.error(`${chalk.red.bold('error: trader is not yet connected to api. please use the [connect] command first.')}`);
    return;
  }
  pm2.connect(function(err) {
    if (err) {
      console.error(`${chalk.red.bold('error: an unknown error has occurred. please try again.')}`);
      process.exit(2);
    }
    switch (proc.name) {
      case 'start':
        if (!database.getConfig('status') || constant.STATUS_STARTED == database.getConfig('status')) {
          pm2.disconnect();
          console.error(`${chalk.red.bold('error: trader has already started.')}`);
        } else {
          pm2.start({name: 'bittrader', script: path.join(__dirname, 'bittrader.js')}, (err, proc) => {
            pm2.disconnect();
            if (err) {
              console.error(`${chalk.red.bold('error: an unknown error has occurred. please try again.')}`);
            } else {
              database.setConfig('status', constant.STATUS_STARTED);
              console.log(`${chalk.green.bold('✓ trader started.')}`);
            }
          });
        }
        break;
      case 'stop':
        if (!database.getConfig('status') || constant.STATUS_STOPPED == database.getConfig('status')) {
          pm2.disconnect();
          console.error(`${chalk.red.bold('error: trader has already stopped.')}`);
        } else {
          pm2.stop('bittrader', (err, proc) => {
            pm2.disconnect();
            if (err) {
              console.error(`${chalk.red.bold('error: an unknown error has occurred. please try again.')}`);
            } else {
              database.setConfig('status', constant.STATUS_STOPPED);
              console.log(`${chalk.green.bold('✓ trader stopped.')}`);
            }
          });
        }
        break;
      case 'restart':
        if (!database.getConfig('status') || (constant.STATUS_STARTED != database.getConfig('status') && constant.STATUS_RESTARTED != database.getConfig('status'))) {
          pm2.disconnect();
          console.error(`${chalk.red.bold('error: trader is not yet started. please use the [start] command.')}`);
        } else {
          pm2.restart('bittrader', (err, proc) => {
            pm2.disconnect();
            if (err) {
              console.error(`${chalk.red.bold('error: an unknown error has occurred. please try again.')}`);
            } else {
              database.setConfig('status', constant.STATUS_RESTARTED);
              console.log(`${chalk.green.bold('✓ trader restarted.')}`);
            }
          });
        }
        break;
      default:
        pm2.disconnect();
        break;
    }
  });
};

/**
 * Run program.
 */
 async function main() {
  program
    .name('bittrader')
    .usage('[command] <options>')
    .description(package.description)
    .version(package.version, '--version', 'output the current version');

  program.command('connect').description('connnect to api')
  .requiredOption('--key <key>', 'set api key (mandatory)')
  .requiredOption('--secret <secret>', 'set api secret (mandatory)')
  .action(connect);

  program.command('config').description('can be used to set up trader')
  .option('--denominator <symbol>', `set denominator symbol of the pair (choices: ${constant.ACCEPTABLE_DENOMINATORS}) (default: ${constant.DEFAULT_DENOMINATOR})`)
  .option('--expression <expression>', `set controller cron expression (what's cron expression? ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')}) (default: ${constant.DEFAULT_EXPRESSION})`)
  .option('--orderamount <amount>', `set order amount for buy (min: 20) (default: ${constant.DEFAULT_ORDER_AMOUNT})`)
  .option('--allowbuy', `if trader catches a buy signal, it automatically buys`)
  .option('--disallowbuy', `don't allow trader to automatically buys`)
  .option('--allowsell', `if trader catches a sell signal, it automatically sells`)
  .option('--disallowsell', `don't allow trader to automatically sells`)
  .option('--username <username>', `set username for web application (default: ${constant.DEFAULT_USERNAME})`)
  .option('--password <password>', `set password for web application (default: ${constant.DEFAULT_PASSWORD})`)
  .option('--port <port>', `set port for web application (default: ${constant.DEFAULT_PORT})`)
  .option('--timezone <timezone>', `set timezone for web application (default: ${constant.DEFAULT_TIMEZONE})`)
  .action(config);

  program.command('balance').description('show balance')
  .option('-h, --hide', `hide low balances`)
  .action(balance);

  program.command('order').description('show orders')
  .action(order);

  program.command('start').description('start trader').action(callproc);
  program.command('stop').description('stop trader').action(callproc);
  program.command('restart').description('restart trader').action(callproc);

  program.command('status').description('show trader status').action(status);

  await program.parseAsync(process.argv);
};

main();