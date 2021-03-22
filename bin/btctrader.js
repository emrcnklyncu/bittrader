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