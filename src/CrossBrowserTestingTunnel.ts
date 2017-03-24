import { watchFile, unwatchFile } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'dojo-core/request';
import { NodeRequestOptions } from 'dojo-core/request/node';
import Tunnel, { TunnelProperties, ChildExecutor, NormalizedEnvironment } from './Tunnel';
import { JobState } from './interfaces';
import { on } from './util';
import Task from 'dojo-core/async/Task';
import { createCompositeHandle, mixin } from 'dojo-core/lang';
import { exec } from 'child_process';

const cbtVersion = '0.0.34';

/**
 * A CrossBrowserTesting tunnel.
 *
 * This tunnel requires some non-standard configuration options (vs the other tunnels):
 *
 *   1. The capabilities must include the username, API key, browser_api_name, and os_api_name properties
 *   2. The Intern proxyUrl must use 'local' instead of 'localhost'
 *
 * An Intern config using this tunnel might be look like:
 *
 * ```js
 * define({
 * 	proxyUrl: 'http://local:9000',
 *
 * 	tunnel: 'CrossBrowserTesting',
 *
 * 	environments: [
 * 		{
 * 			browserName: 'chrome',
 * 			os_api_name: 'Win10',
 * 			browser_api_name: 'Chrome52'
 * 		}
 * 	]
 *
 * 	// Other Intern config options...
 * });
 * ```
 */
export default class CrossBrowserTestingTunnel extends Tunnel implements CrossBrowserTestingProperties {
	/**
	 * The CrossBrowserTesting API key. This will be initialized with the value of the `CBT_APIKEY` environment
	 * variable.
	 *
	 * @default the value of the CBT_APIKEY environment variable
	 */
	apiKey: string;

	/**
	 * The CrossBrowserTesting username. This will be initialized with the value of the `CBT_USERNAME` environment
	 * variable.
	 *
	 * @default the value of the CBT_USERNAME environment variable
	 */
	username: string;

	cbtVersion: string;

	get auth() {
		return `${this.username || ''}:${this.apiKey || ''}`;
	}

	get extraCapabilities() {
		return {
			username: this.username,
			password: this.apiKey
		};
	}

	get isDownloaded() {
		try {
			require('cbt_tunnels');
			return true;
		}
		catch (error) {
			return false;
		}
	}

	constructor(options?: CrossBrowserTestingOptions) {
		super(mixin({
			apiKey: process.env.CBT_APIKEY,
			cbtVersion,
			environmentUrl: 'https://crossbrowsertesting.com/api/v3/selenium/browsers?format=json',
			executable: 'node',
			hostname: 'hub.crossbrowsertesting.com',
			port: '80',
			username: process.env.CBT_USERNAME
		}, options));
	}

	download(forceDownload = false): Task<any> {
		if (!forceDownload && this.isDownloaded) {
			return Task.resolve();
		}
		return new Task((resolve, reject) => {
			exec(`npm install cbt_tunnels@${this.cbtVersion}`, (error, stdout, stderr) => {
				if (error) {
					console.error(stderr);
					reject(error);
				}
				else {
					resolve();
				}
			});
		});
	}

	protected _makeArgs(readyFile: string): string[] {
		return [
			'node_modules/.bin/cbt_tunnels',
			'--authkey', this.apiKey,
			'--username', this.username,
			'--ready', readyFile
		];
	}

	sendJobState(jobId: string, data: JobState): Task<void> {
		const payload = JSON.stringify({
			action: 'set_score',
			score: (data.status || data.success) ? 'pass' : 'fail'
		});

		const url = `https://crossbrowsertesting.com/api/v3/selenium/${jobId}`;
		return <Task<any>> request.put<string>(url, <NodeRequestOptions<any>> {
			data: payload,
			headers: {
				'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
				'Content-Type': 'application/json'
			},
			user: this.username,
			password: this.apiKey,
			proxy: this.proxy
		}).then(function (response) {
			if (response.data) {
				const data = JSON.parse(response.data);

				if (data.status) {
					throw new Error(`Could not save test status (${data.message})`);
				}

				if (response.statusCode !== 200) {
					throw new Error(`Server reported ${response.statusCode} with: ${response.data}`);
				}
			}
			else {
				throw new Error(`Server reported ${response.statusCode} with no other data.`);
			}
		});
	}

	protected _start(executor: ChildExecutor) {
		const readyFile = join(tmpdir(), 'CrossBrowserTesting-' + Date.now());

		return this._makeChild((child, resolve, reject) => {
			let stdout: string[] = [];

			// Polling API is used because we are only watching for one file, so efficiency is not a big deal, and the
			// `fs.watch` API has extra restrictions which are best avoided
			watchFile(readyFile, { persistent: false, interval: 1007 }, function (current, previous) {
				if (Number(current.mtime) === Number(previous.mtime)) {
					// readyFile hasn't been modified, so ignore the event
					return;
				}

				unwatchFile(readyFile);
				readHandle.destroy();
				exitHandle.destroy();
				stdout = null;
				resolve();
			});

			// The cbt tunnel outputs its startup error messages on stdout. Capture any data on stdout and display it if the
			// process exits early.
			const readHandle = on(child.stdout, 'data', (data: any) => {
				stdout.push(String(data));
			});
			const exitHandle = on(child, 'exit', function () {
				process.stderr.write(stdout.join(''));
			});

			this._handle = createCompositeHandle(readHandle, exitHandle);

			executor(child, resolve, reject);
		}, readyFile);
	}

	/**
	 * Attempt to normalize a TestingBot described environment with the standard Selenium capabilities
	 *
	 * TestingBot returns a list of environments that looks like:
	 *
	 * {
	 *     "selenium_name": "Chrome36",
	 *     "name": "googlechrome",
	 *     "platform": "CAPITAN",
	 *     "version":"36"
	 * }
	 *
	 * @param environment a TestingBot environment descriptor
	 * @returns a normalized descriptor
	 */
	protected _normalizeEnvironment(environment: any): NormalizedEnvironment {
		const platform = environment.api_name;

		return environment.browsers.map(function (browser: any) {
			const browserName = browser.type.toLowerCase();

			return {
				platform,
				browserName,
				version: browser.version,

				descriptor: environment,

				intern: {
					browserName,
					version: browser.version,
					browser_api_name: browser.api_name,
					os_api_name: platform
				}
			};
		});
	}
}

export interface CrossBrowserTestingProperties extends TunnelProperties {
	apiKey: string;
}

export type CrossBrowserTestingOptions = Partial<CrossBrowserTestingProperties>;
