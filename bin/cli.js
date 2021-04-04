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
 * Set timezone.
 */
process.env.TZ = database.getConfig('timezone');

/**
 * Program actions.
 */
 let connect = async (args) => {
  try {
    let balances = await client.getBalances(database.getConfig('denominator'), args.key, args.secret);
    database.setBalances(balances);
  } catch (e) {
    console.error(`${chalk.red.bold('error: cannot access api.')}`);
    console.error(e);
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
  if (args.orderamount) {
    let orderamount = Number.parseFloat(args.orderamount, 10);
    if (Number.isNaN(orderamount) || orderamount < constant.DEFAULT_ORDER_AMOUNT) {
      console.error(chalk.red.bold(`error: order amount must be greather then ${constant.DEFAULT_ORDER_AMOUNT}.`));
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
    let balances = database.getBalances();
    console.log(`|${util.padRight('', 44, '-')}|`);
    let totalMoney = 0;
    for (b in balances) {
      let balance = balances[b];
      if (args.hide) {
        let fbalance = Number.parseFloat(balance.balance, 10);
        if (fbalance <= 0.0001) {
          continue;
        }
      }
      totalMoney = totalMoney + balance.money;
      console.log(`| ${util.padRight(balance.asset, 5)} | ${util.padLeft(util.formatMoney(balance.free, 4), 16)} | ${util.padLeft(util.formatMoney(balance.money, 4), 16)}|`);
    }
    console.log(`|${util.padRight('', 44, '-')}|`);
    console.log(`| ${util.padRight('TOTAL', 5)} ${util.padLeft('', 20)} ${util.padLeft(util.formatMoney(totalMoney, 4), 16)}|`);
    console.log(`|${util.padRight('', 44, '-')}|`);
  } catch (e) {
    console.error(`${chalk.red.bold('error: an unknown error has occurred. please try again.')}`);
    console.error(e);
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
  .option('--username <username>', `set username for web application (default: ${constant.DEFAULT_USERNAME})`)
  .option('--password <password>', `set password for web application (default: ${constant.DEFAULT_PASSWORD})`)
  .option('--port <port>', `set port for web application (default: ${constant.DEFAULT_PORT})`)
  .option('--timezone <timezone>', `set timezone for web application (default: ${constant.DEFAULT_TIMEZONE})`)
  .option('--denominator <asset>', `set denominator of the pair (choices: ${constant.ACCEPTABLE_DENOMINATORS}) (default: ${constant.DEFAULT_DENOMINATOR})`)
  .option('--orderamount <amount>', `set order amount for buy (min: ${constant.DEFAULT_ORDER_AMOUNT}) (default: ${constant.DEFAULT_ORDER_AMOUNT})`)
  .option('--allowbuy', `if trader catches a buy signal, it automatically buys`)
  .option('--disallowbuy', `don't allow trader to automatically buys`)
  .option('--allowsell', `if trader catches a sell signal, it automatically sells`)
  .option('--disallowsell', `don't allow trader to automatically sells`)
  .action(config);

  program.command('balance').description('show balance')
  .option('-h, --hide', `hide low balances`)
  .action(balance);

  program.command('start').description('start trader').action(callproc);
  program.command('stop').description('stop trader').action(callproc);
  program.command('restart').description('restart trader').action(callproc);

  program.command('status').description('show trader status').action(status);

  await program.parseAsync(process.argv);
};

main();