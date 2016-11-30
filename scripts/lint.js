#!/usr/bin/env node

var shell = require('shelljs');
var path = require('path');
var exec = require('./common').exec;

var dir = path.join(__dirname, '..');

shell.cd(dir);
shell.echo('### Linting DigDug');

exec('./node_modules/.bin/tslint -c tslint.json ./src/**/*.ts');
