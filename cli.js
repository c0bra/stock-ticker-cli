#!/usr/bin/env node
/* eslint curly: off */
/* eslint capitalized-comments: off */
'use strict';
const assign = require('lodash/assign');
const axios = require('axios');
const chalk = require('chalk');
const cliTruncate = require('cli-truncate');
const logUpdate = require('log-update');
const meow = require('meow');
const orderBy = require('lodash/orderBy');

const tops = 'https://ws-api.iextrading.com/1.0/tops';
const quote = 'https://api.iextrading.com/1.0/stock/:stock/quote';

const socket = require('socket.io-client')(tops);
// const stockTickerCli = require('.');

const stats = {};

// const cli =
meow(`
	Usage
	  $ stock-ticker-cli

	Examples
	  $ stock-ticker-cli

	Yup, that's it.
`);

startup();

// ------------ //

function startup() {
	// Listen to the channel's messages
	socket.on('message', message => handleMessage(message));

	// Connect to the channel
	socket.on('connect', () => {
		// Subscribe to topics (i.e. appl,fb,aig+)
		socket.emit('subscribe', 'firehose');

		// Unsubscribe from topics (i.e. aig+)
		// socket.emit('unsubscribe', 'aig+');
		startLog();
	});

	// Disconnect from the channel
	socket.on('disconnect', () => console.log('Disconnected.'));
}

function startLog() {
	setInterval(() => log(), 1000);
}

function log() {
	const out = orderBy(stats, 'symbol')
	.map(stock => {
		// console.log('stock', stock);

		const change = parseFloat(stock.lastSalePrice - (stock.open || 0)).toFixed(2);

		let color = s => s;
		if (stock.lastSalePrice !== 0) {
			color = change > 0 ? chalk.green : chalk.red;
		}
		const dir = change > 0 ? '+' : '';

		return `${stock.symbol} ${chalk.bold(stock.lastSalePrice)} ${color(dir + change)}`;
	})
	.join('  \u007C  ');

	logUpdate(cliTruncate(out, process.stdout.columns));
}

function getOpen(symbol) {
	stats[symbol] = stats[symbol] || {};

	if (stats[symbol].open) return null;

	const url = quote.replace(':stock', symbol);

	axios(url)
	.then(result => {
		// console.log(`Got ${symbol}`);
		assign(stats[symbol], result.data);
	});
}

function handleMessage(message) {
	message = JSON.parse(message);

	const symbol = message.symbol;
	stats[symbol] = stats[symbol] || {};

	Promise.resolve(getOpen(message.symbol))
	.then(() => {
		assign(stats[symbol], message);
	});
}
