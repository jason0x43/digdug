#!/usr/bin/env node

var shell = require('shelljs');
var path = require('path');
var exec = require('./common').exec;
var exitGracefully = require('./common').exitGracefully;

var dir = path.join(__dirname, '..');

shell.cd(dir);
shell.echo('### Testing DigDug');

exec('./node_modules/.bin/tsc -p ./tsconfig.tests.json')
	.then(function () {
		return exec('./node_modules/.bin/intern-client config=dist/tests/intern');
	})
	.catch(exitGracefully);
