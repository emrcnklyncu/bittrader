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
    console.error(`${chalk.red.bold('error: cannot access api')}`);
    console.error(`${chalk.red.bold(e.code, e.text)}`);
    return;
  }
  database.setConfig('key', args.key);
  database.setConfig('secret', args.secret);
  database.setConfig('status', constant.STATUS_CONNECTED);
  console.log(`${chalk.green.bold('✓ everything is ok.')}`);
};
let config = async (args) => {
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
  if (args.stoploss) {
    let stoploss = Number.parseFloat(args.stoploss, 10);
    if (Number.isNaN(stoploss) || stoploss > 20 || stoploss < 2) {
      console.error(`${chalk.red.bold('error: stop loss ratio must be between 2 and 20.')}`);
      return;
    } else {
      database.setConfig('stoploss', stoploss);
    }
  }
  if (args.targetgain) {
    let targetgain = Number.parseFloat(args.targetgain, 10);
    if (Number.isNaN(targetgain) || targetgain > 20 || targetgain < 2) {
      console.error(`${chalk.red.bold('error: target gain ratio must be between 2 and 20.')}`);
      return;
    } else {
      database.setConfig('targetgain', targetgain);
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
  console.log(`${chalk.green.bold('✓ parameters have changed.')}`);
  if (constant.STATUS_STARTED == database.getConfig('status')) callproc(null, {name: 'restart'});
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
        if (!database.getConfig('status') || constant.STATUS_STARTED != database.getConfig('status')) {
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
    .version(package.version, '-v, --version', 'output the current version');

  program.command('connect').description('connnect to api')
  .requiredOption('-k, --key <key>', 'set api key (mandatory)')
  .requiredOption('-s, --secret <secret>', 'set api secret (mandatory)')
  .action(connect);

  program.command('config').description('can be used to set up trader')
  .option('-d, --denominator <symbol>', `set denominator symbol of the pair (choices: ${constant.ACCEPTABLE_DENOMINATORS}) (default: ${constant.DEFAULT_DENOMINATOR})`)
  .option('-e, --expression <expression>', `set controller cron expression (what's cron expression? ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')}) (default: ${constant.DEFAULT_EXPRESSION})`)
  .option('-s, --stoploss <ratio>', `set stop loss ratio (%) (2-20) (default: ${constant.DEFAULT_STOP_LOSS_RATIO})`)
  .option('-t, --targetgain <ratio>', `set target gain ratio (%) (2-20) (default: ${constant.DEFAULT_TARGET_GAIN_RATIO})`)
  .option('-a, --orderamount <amount>', `set order amount for purchases (min: 20) (default: ${constant.DEFAULT_ORDER_AMOUNT})`)
  .action(config);

  program.command('start').description('start trader').action(callproc);
  program.command('stop').description('stop trader').action(callproc);
  program.command('restart').description('restart trader').action(callproc);

  //alışta bb min altı
  //satışta bb max üstü
  //

  /**
   * status
   * orders
   * balance
   */

  await program.parseAsync(process.argv);
};

main();
  