import * as assert from 'intern/chai!assert';
import { args } from 'intern';
import SeleniumTunnel, { DriverFile } from 'src/SeleniumTunnel';
import ChromeConfig from 'src/configs/ChromeConfig';
import IeConfig from 'src/configs/IeConfig';
import FirefoxConfig from 'src/configs/FirefoxConfig';
import { readdirSync } from 'fs';
import { cleanup, deleteTunnelFiles } from '../support/cleanup';
import SeleniumConfig from 'src/configs/SeleniumConfig';
import checkRemote from '../support/checkRemote';
import Tunnel from 'src/Tunnel';
import tunnelTest from '../support/tunnelTest';
import Test = require('intern/lib/Test');
import registerSuite = require('intern!object');

const PORT = '4445';
let tunnel: SeleniumTunnel;

type ExtendedDriverFile = DriverFile & {
	_testName: string;
};

const allDriverConfigurations: DriverFile[] = [
	new ChromeConfig({
		_testName: 'ChromeDriver windows',
		platform: 'win32'
	}),
	new ChromeConfig({
		_testName: 'ChromeDriver linux 64-bit',
		platform: 'linux',
		arch: 'x64'
	}),
	new ChromeConfig({
		_testName: 'ChromeDriver linux 32-bit',
		platform: 'linux',
		arch: 'x86'
	}),
	new ChromeConfig({
		_testName: 'ChromeDriver mac',
		platform: 'darwin'
	}),
	new ChromeConfig({
		_testName: 'ChromeDriver windows',
		platform: 'win32'
	}),
	new IeConfig({
		_testName: 'IE Driver 64-bit',
		arch: 'x64'
	}),
	new IeConfig({
		_testName: 'IE Driver 32-bit',
		arch: 'x86'
	}),
	new FirefoxConfig({
		_testName: 'Firefox Driver linux',
		platform: 'linux'
	}),
	new FirefoxConfig({
		_testName: 'Firefox Driver mac',
		platform: 'darwin'
	}),
	new FirefoxConfig({
		_testName: 'Firefox Driver windows',
		platform: 'win32'
	})
];

function instrumentTunnel(tunnel: Tunnel) {
	tunnel.on('downloadprogress', function (info) {
		console.log('download progress: ', info.progress.loaded, info.progress.total);
	});
	tunnel.on('filedownloadprogress', function (info) {
		console.log(info.url, info.progress.loaded, info.progress.total);
	});
	tunnel.on('postdownload', function (url) {
		console.log('Post download', url);
	});
}

function assertDownload(config = {}) {
	tunnel = new SeleniumTunnel(config);
	const expected = tunnel['_getConfigs']().map(function (config) {
		return config.executable;
	}).filter(function (executable) {
		// Remove any skipped selenium standalone
		return executable !== '..';
	});

	if (args.verbose) {
		instrumentTunnel(tunnel);
	}

	return tunnel.download().then(function () {
		const files = readdirSync(tunnel.directory);
		assert.includeMembers(files, expected);
	});
}

registerSuite({
	name: 'integration/SeleniumTunnel',

	setup() {
		return cleanup(new SeleniumTunnel());
	},

	teardown() {
		return cleanup(new SeleniumTunnel());
	},

	'remote artifact exists': (function () {
		const tests = {
			'selenium standalone': function () {
				const config = new SeleniumConfig();

				return checkRemote(config.url);
			}
		};

		allDriverConfigurations.forEach(function (config: ExtendedDriverFile) {
			(<any> tests)[config._testName] = function () {
				return checkRemote(config.url);
			};
		});

		return tests;
	})(),

	download: (function () {
		const tests = {
			'selenium standalone': function () {
				return assertDownload({
					seleniumDrivers: [ ]
				});
			}
		};

		allDriverConfigurations.forEach(function (config: ExtendedDriverFile) {
			(<any> tests)[config._testName] = function () {
				return assertDownload({
					// We don't want to download selenium every time so we're going to change the
					// Selenium configuration so isDownloaded() should always report true for Selenium
					seleniumVersion: new SeleniumConfig({
						executable: '..'
					}),
					seleniumDrivers: [ config ]
				});
			};
		});

		return tests;
	})(),

	'isDownloaded'(this: Test) {
		if (args.noClean) {
			return this.skip('Cleanup is disabled');
		}
		tunnel = new SeleniumTunnel();
		deleteTunnelFiles(tunnel);

		assert.isFalse(tunnel.isDownloaded, 'expected isDownloaded to be false');
	},

	'start'(this: Test) {
		tunnel = new SeleniumTunnel({
			port: PORT,
			seleniumDrivers: [ ]
		});

		return tunnelTest(this.async(120000), tunnel);
	},

	'stop'() {
		tunnel = new SeleniumTunnel({
			port: PORT,
			seleniumDrivers: [ ]
		});

		return tunnel.start().then(function () {
			tunnel.stop();
		});
	}
});
