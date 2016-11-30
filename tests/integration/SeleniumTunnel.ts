import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import { args } from 'intern';
import SeleniumTunnel, { DriverFile } from 'src/SeleniumTunnel';
import ChromeConfig from 'src/configs/ChromeConfig';
import IeConfig from 'src/configs/IeConfig';
import FirefoxConfig from 'src/configs/FirefoxConfig';
import { readdirSync } from 'fs';
import isSeleniumStarted from '../support/isSeleniumStarted';
import { cleanup, deleteTunnelFiles } from '../support/cleanup';
import SeleniumConfig from 'src/configs/SeleniumConfig';
import checkRemote from '../support/checkRemote';
import Tunnel from 'src/Tunnel';
import tunnelTest from '../support/tunnelTest';
import request = require('dojo/request');
import Test = require('intern/lib/Test');

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

function assertDownload(config: Object = {}) {
	tunnel = new SeleniumTunnel(config);
	const expected = (<any> tunnel)._getConfigs().map(function (config: DriverFile) {
		return config.executable;
	}).filter(function (executable: string) {
		// Remove any skipped selenium standalone
		return executable !== '..';
	});

	if (args.verbose) {
		instrumentTunnel(tunnel);
	}

	return tunnel.download()
		.then(function () {
			const files = readdirSync(tunnel.directory);
			assert.includeMembers(files, expected);
		});
}

registerSuite({
	name: 'integration/SeleniumTunnel',

	beforeEach(test: any) {
		test.timeout =  10 * 60 * 1000; // ten minutes

		// Ensure Selenium is not running on our test port
		return isSeleniumStarted(PORT)
			.then(function () {
				return request(`http://localhost:${ PORT }/selenium-server/driver/?cmd=shutDownSeleniumServer`, {});
			}, function () {
				// We don't expect selenium to be already running
				return true;
			});
	},

	afterEach: function () {
		return cleanup(tunnel);
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

	'isDownloaded': {
		'returns false when files are missing'(this: Test) {
			if (args.noClean) {
				return this.skip('Cleanup is disabled');
			}
			tunnel = new SeleniumTunnel();
			deleteTunnelFiles(tunnel);

			assert.isFalse(tunnel.isDownloaded);
		}
	},

	'start': {
		'runs selenium-standalone'(this: Test) {
			tunnel = new SeleniumTunnel({
				port: PORT,
				seleniumDrivers: [ ]
			});

			return tunnelTest(this.async(120000), tunnel);
		}
	},

	'stop': {
		beforeEach: function () {
			tunnel = new SeleniumTunnel({
				port: PORT,
				seleniumDrivers: [ ]
			});

			return tunnel.start()
				.then(function () {
					return isSeleniumStarted(tunnel.port, tunnel.hostname);
				});
		},

		'shuts down a running selenium': function () {
			return tunnel.stop()
				.then(function () {
					return isSeleniumStarted()
						.then(function () {
							throw new Error('tunnel is still running');
						}, function () {
							return true;
						});
				});
		}
	}
});
