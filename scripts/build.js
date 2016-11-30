#!/usr/bin/env node

var shell = require('shelljs');
var path = require('path');
var exec = require('./common').exec;

var dir = path.join(__dirname, '..');

shell.cd(dir);
shell.echo('### Building DigDug');

exec('./node_modules/.bin/tsc')
	.then(function () {
		shell.cp('./src/interfaces.d.ts', './dist/src');
	});
