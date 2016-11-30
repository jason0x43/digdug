#!/usr/bin/env node

var shell = require('shelljs');
var path = require('path');
var exec = require('./common').exec;

var dir = path.join(__dirname, '..');

shell.cd(dir);
shell.echo('### Preparing Distro for DigDug');

exec('node ./scripts/clean.js')
	.then(function () {
		return exec('node ./scripts/lint.js');
	})
	.then(function () {
		return exec('node ./scripts/build.js');
	})
	.then(function () {
		return exec('node ./scripts/test.js');
	})
	.then(function () {
		shell.echo('### Copying Distro files');

		var files = {
			'./package.json': './dist/src',
			'./LICENSE': './dist/src'
		};

		for (var src in files) {
			var dest = files[src];
			shell.cp(src, dest);
		}
	});
