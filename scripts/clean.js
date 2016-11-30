#!/usr/bin/env node

var shell = require('shelljs');
var path = require('path');

shell.echo('### Cleaning DigDug');

[
	path.join(__dirname, '..', 'dist'),
	path.join(__dirname, '..', 'browserstack'),
	path.join(__dirname, '..', 'saucelabs'),
	path.join(__dirname, '..', 'selenium-standalone'),
	path.join(__dirname, '..', 'testingbot')
].forEach(function (dir) {
	console.log('removing ' + dir);
	shell.rm('-rf', dir);
});

