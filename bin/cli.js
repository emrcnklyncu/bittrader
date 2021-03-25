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
  console.log(`${chalk.green.bold('✓ parameters have changed.')}`);
  await callproc(null, {_name: 'restart'});
};
let callproc = async (args, command) => {
  pm2.connect(function(err) {
    if (err) {
      console.error(err);
      process.exit(2);
    }
    switch (command._name) {
      case 'start':
        pm2.start({name: 'bittrader', script: path.join(__dirname, 'bittrader.js')}, (err, proc) => {
          pm2.disconnect();
          database.setConfig('status', constant.STATUS_STARTED);
          console.log(`${chalk.green.bold('✓ trader started.')}`);
        });
        break;
      case 'stop':
        pm2.stop('bittrader', (err, proc) => {
          pm2.disconnect();
          database.setConfig('status', constant.STATUS_STOPPED);
          console.log(`${chalk.green.bold('✓ trader stopped.')}`);
        });
        break;
      case 'restart':
        pm2.restart('bittrader', (err, proc) => {
          pm2.disconnect();
          database.setConfig('status', constant.STATUS_RESTARTED);
          console.log(`${chalk.green.bold('✓ trader restarted.')}`);
        });
        break;
      default:
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
  .option('-d, --denominator <symbol>', `set denominator symbol of the pair (choices: ${constant.ACCEPTABLE_DENOMINATORS}) (default: USDT)`)
  .option('-e, --expression <expression>', `set controller cron expression (what's cron expression? ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')}) (default: ${constant.DEFAULT_EXPRESSION})`)
  .option('-s, --stoploss <ratio>', `set stop loss ratio (%) (2-20) (default: ${constant.DEFAULT_STOP_LOSS_RATIO})`)
  .option('-t, --targetgain <ratio>', `set target gain ratio (%) (2-20) (default: ${constant.DEFAULT_TARGET_GAIN_RATIO})`)
  .action(config);

  program.command('start').description('start trader').action(callproc);
  program.command('stop').description('stop trader').action(callproc);
  program.command('restart').description('restart trader').action(callproc);

  //alışta bb min altı
  //satışta bb max üstü
  //

  /**
   * status
   * transactions
   */

  await program.parseAsync(process.argv);
};

main();
  