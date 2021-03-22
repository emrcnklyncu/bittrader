#!/usr/bin/env node

/**
 * Module dependencies.
 */
const chalk = require('chalk');
const dotenv = require('dotenv');
const path = require('path');

/**
 * Load environment variables from .env file, where API keys and passwords are configured.
 */
dotenv.load({ path: 'environments/default.env' });

/**
 * Import libraries.
 */
const util = require('../libraries/util')();

/**
 * 
 */
function displayHelp() {

  console.log(`
  ${chalk.yellow('usage: bittrader [command] <parameter>')}
  
    version   : show bittrader version
    help      : output the help

  `);

};

function main() {

  console.log(`
  ${chalk.green('|========================================================|')}
  ${chalk.green('|')} ${util.padRight('', 54)} ${chalk.green('|')}
  ${chalk.green('|')} ${chalk.green(`BitTrader - ${util.padRight(process.env.DESCRIPTION, 42)}`)} ${chalk.green('|')}
  ${chalk.green('|')} ${chalk.green(`version: ${util.padRight(process.env.VERSION,45)}`)} ${chalk.green('|')}
  ${chalk.green('|')} ${util.padRight('', 54)} ${chalk.green('|')}
  ${chalk.green('|========================================================|')}
  `);
  
  var uid = process.env.UID;
  var dir = process.cwd();
  var args = process.argv.splice(process.execArgv.length + 2);
  var cmd = args[0];
  var param = args[1];

  if ('version' === cmd) {
    return;
  }
  if ('help' === cmd) {
    displayHelp();
    return;
  }

};

main();