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
  database.setConfig('status', 'connected');
  console.log(`${chalk.green.bold('✓ everything is ok.')}`);
};
let config = async (args) => {
  if (!ACCEPTABLE_DENOMINATORS.split(',').includes(args.denominator)) {
    console.error(`${chalk.red.bold('error: not acceptable denominator.')}\nacceptable denominators: ${constant.ACCEPTABLE_DENOMINATORS}`);
    return;
  }
  if (!cron.validate(args.expression)) {
    console.error(`${chalk.red.bold('error: cron expression is invalid.')}\nplease click for more details of cron expression: ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')}`);
    return;
  }
  let stoploss = Number.parseInt(args.stoploss, 10);
  let targetgain = Number.parseInt(args.targetgain, 10);
  if (Number.isNaN(stoploss) || stoploss > 20 || stoploss < 2) {
    console.error(`${chalk.red.bold('error: stop loss ratio must be between 2 and 20.')}`);
    return;
  } else {
    args.stoploss = stoploss;
  }
  if (Number.isNaN(targetgain) || targetgain > 20 || targetgain < 2) {
    console.error(`${chalk.red.bold('error: target gain ratio must be between 2 and 20.')}`);
    return;
  } else {
    args.targetgain = targetgain;
  }
  database.saveConfigs(args);
  console.log(`${chalk.green.bold('✓ everything is ok.')}`);
};
let service = async (args, command) => {
  pm2.connect(function(err) {
    if (err) {
      console.error(err);
      process.exit(2);
    }
    switch (command._name) {
      case 'start':
        pm2.start({name: 'bittrader', script: path.join(__dirname, 'bittrader.js')}, (err, proc) => {
          pm2.disconnect();
        });
        break;
      case 'stop':
        pm2.stop('bittrader', (err, proc) => {
          pm2.disconnect();
        });
        break;
      case 'restart':
        pm2.restart('bittrader', (err, proc) => {
          pm2.disconnect();
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

  program.command('config').description('can be used to set up bittrader')
  .option('-d, --denominator <symbol>', `set denominator symbol of the pair (choices: ${constant.ACCEPTABLE_DENOMINATORS})`, 'USDT')
  .option('-e, --expression <expression>', `set controller cron expression (what's cron expression? ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')})`, '*/5 * * * *')
  .option('-s, --stoploss <ratio>', `set stop loss ratio (%) (2-20)`, 2)
  .option('-t, --targetgain <ratio>', `set target gain ratio (%) (2-20)`, 2)
  .action(config);

  program.command('start').description('start trader').action(service);
  program.command('stop').description('stop trader').action(service);
  program.command('restart').description('restart trader').action(service);

  //alışta bb min altı
  //satışta bb max üstü
  //

  /**
   * connect
   * config
   * status
   * transactions
   */

  await program.parseAsync(process.argv);
};

main();
  