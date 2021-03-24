#!/usr/bin/env node

/**
 * Module dependencies.
 */
const { program } = require('commander');
const chalk = require('chalk');
const pm2 = require('pm2');
const cron = require('node-cron');
const package = require('../package.json');

/**
 * Import libraries.
 */
const util = require('../libraries/util')();
const database = require('../libraries/database')();
const client = require('../libraries/client')();

/**
 * Constants.
 */
const ACCEPTABLE_CURRENCIES = "USDT,TRY";

/**
 * Program actions.
 */
let init = async (args) => {
  try {
    await client.getAccountBalance(args.key, args.secret);
  } catch (e) {
    console.info(`${chalk.red.bold('error: api key or api secret is invalid.')}`);
    return;
  }
  if (!ACCEPTABLE_CURRENCIES.split(',').includes(args.currency)) {
    console.info(`${chalk.red.bold('error: not acceptable currency.')}\nacceptable currencies: ${ACCEPTABLE_CURRENCIES}`);
    return;
  }
  if (!cron.validate(args.expression)) {
    console.info(`${chalk.red.bold('error: cron expression is invalid.')}\nplease click for more details of cron expression: ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')}`);
    return;
  }
  database.saveConfig(args);
  console.info(`${chalk.green.bold('✓ everything is ok.')}`);
};
let start = () => {
  pm2.connect(function(err) {
    if (err) {
      console.error(err)
      process.exit(2)
    }
  
    pm2.start({
      script: 'task.js',
    }, (err, apps) => {
      pm2.disconnect()
      if (err) { throw err }
    })
  })
};
let stop = () => {
  pm2.connect(function(err) {
    if (err) {
      console.error(err)
      process.exit(2)
    }
  
    pm2.stop('task', (err, apps) => {
      pm2.disconnect()
      if (err) { throw err }
    })
  })
};
let desc = () => {
  pm2.connect(function(err) {
    if (err) {
      console.error(err)
      process.exit(2)
    }
  
    pm2.describe('pp', (err, apps) => {
      console.info(err, apps);
      pm2.disconnect()
      if (err) { throw err }
    })
  })
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

  program.command('init')
  .requiredOption('-k, --key <key>', 'set api key')
  .requiredOption('-s, --secret <secret>', 'set api secret')
  .option('-c, --currency <symbol>', `set numerator currency symbol of the pair (choices: ${ACCEPTABLE_CURRENCIES})`, 'USDT')
  .option('-e, --expression <expression>', `set controller cron expression (what's cron expression? ${chalk.yellow.underline('https://en.wikipedia.org/wiki/Cron#CRON_expression')})`, '*/5 * * * *')
  .action(init);

  /*
  brew
    .command('start')
    .action(start);
  brew
    .command('stop')
    .action(stop);
    brew
    .command('desc')
    .action(desc);

  // Add nested commands using `.addCommand().
  // The command could be created separately in another module.

    const heat = program.command('heat');
    heat
      .command('jug')
      .action(() => {
        console.log('heat jug');
      });
    heat
      .command('pot')
      .action(() => {
        console.log('heat pot');
      });
  */
  await program.parseAsync(process.argv);
};

main();
  