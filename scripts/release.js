#!/usr/bin/env node

var shell = require('shelljs');
var path = require('path');
var exec = require('./common').exec;
var fs = require('fs');

var dir = path.join(__dirname, '../dist/src');
var package = require(path.join(dir, 'package.json'));

shell.cd(dir);
shell.echo('### Checking DigDug');

function prepublishCheck() {
	var skipVersionCheck = process.env.SKIP_VERSION_CHECK === 'true';

	if (!skipVersionCheck && package.version.indexOf('-') !== -1) {
		shell.echo('ERROR: Labeled version not allowed: ' + package.version);
		process.exitCode = 1;
		return false;
	}

	return true;
}

if (prepublishCheck()) {
	shell.cd(dir);
	exec('npm publish');
}
