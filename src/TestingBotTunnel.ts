/**
 * @module digdug/TestingBotTunnel
 */

import Tunnel, { TunnelOptions, ChildDescriptor } from './Tunnel';
import { mixin, on } from './util';
import { join as joinPath } from 'path';
import { parse as parseUrl } from 'url';
import { INodeRequestOptions } from 'dojo/request/node';
import { tmpdir } from 'os';
import { watchFile, unwatchFile, existsSync } from 'fs';
import { JobState } from './interfaces';
import ioQuery = require('dojo/io-query');
import request = require('dojo/request');

export interface TestingBotEnvironment {
	selenium_name: string;
	name: string;
	platform: string;
	version: string;
}

export default class TestingBotTunnel extends Tunnel {
	/**
	 * The TestingBot API key.
	 *
	 * @type {string}
	 * @default the value of the TESTINGBOT_API_KEY environment variable
	 */
	apiKey: string;

	/**
	 * The TestingBot API secret.
	 *
	 * @type {string}
	 * @default the value of the TESTINGBOT_API_SECRET environment variable
	 */
	apiSecret: string;

	/**
	 * A list of regular expressions corresponding to domains whose connections should fail immediately if the VM
	 * attempts to make a connection to them.
	 *
	 * @type {string[]}
	 */
	fastFailDomains: string[];

	/**
	 * A filename where additional logs from the tunnel should be output.
	 *
	 * @type {string}
	 */
	logFile: string;

	/**
	 * Whether or not to use rabbIT compression for the tunnel connection.
	 *
	 * @type {boolean}
	 * @default
	 */
	useCompression: boolean;

	/**
	 * Whether or not to use the default local Jetty proxy for the tunnel.
	 *
	 * @type {boolean}
	 * @default
	 */
	useJettyProxy: boolean;

	/**
	 * Whether or not to use the default remote Squid proxy for the VM.
	 *
	 * @type {boolean}
	 * @default
	 */
	useSquidProxy: boolean;

	/**
	 * Whether or not to re-encrypt data encrypted by self-signed certificates.
	 *
	 * @type {boolean}
	 * @default
	 */
	useSsl: boolean;

	/**
	 * The URL of a service that provides a list of environments supported by TestingBot.
	 */
	environmentUrl: string;

	constructor(kwArgs?: TunnelOptions) {
		super(mixin({
			fastFailDomains: []
		}, kwArgs));
	}

	get auth() {
		return `${this.apiKey}:${this.apiSecret}`;
	}

	get isDownloaded() {
		return existsSync(joinPath(this.directory, 'testingbot-tunnel/testingbot-tunnel.jar'));
	}

	_makeArgs(readyFile: string) {
		const args = [
			'-jar', 'testingbot-tunnel/testingbot-tunnel.jar',
			this.apiKey,
			this.apiSecret,
			'-P', this.port,
			'-f', readyFile
		];

		this.fastFailDomains.length && args.push('-F', this.fastFailDomains.join(','));
		this.logFile && args.push('-l', this.logFile);
		this.useJettyProxy || args.push('-x');
		this.useSquidProxy || args.push('-q');
		this.useCompression && args.push('-b');
		this.useSsl && args.push('-s');
		this.verbose && args.push('-d');

		if (this.proxy) {
			const proxy = parseUrl(this.proxy);

			proxy.hostname && args.unshift('-Dhttp.proxyHost=', proxy.hostname);
			proxy.port && args.unshift('-Dhttp.proxyPort=', proxy.port);
		}

		return args;
	}

	sendJobState(jobId: string, data: JobState): Promise<void> {
		const payload: {
			groups?: any;
			[ key: string ]: any;
		} = {};

		data.success != null && (payload['test[success]'] = data.success ? 1 : 0);
		data.status && (payload['test[status_message]'] = data.status);
		data.name && (payload['test[name]'] = data.name);
		data.extra && (payload['test[extra]'] = JSON.stringify(data.extra));
		data.tags && data.tags.length && (payload.groups = data.tags.join(','));

		const payloadStr = ioQuery.objectToQuery(payload);
		const options: INodeRequestOptions = {
			data: payloadStr,
			headers: {
				'Content-Length': String(Buffer.byteLength(payloadStr, 'utf8')),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			password: this.apiSecret,
			user: this.apiKey,
			proxy: this.proxy
		};

		return request.put(`https://api.testingbot.com/v1/tests/${jobId}`, options).then(function (response) {
			if (response.data) {
				const data = JSON.parse(response.data);

				if (data.error) {
					throw new Error(data.error);
				}
				else if (!data.success) {
					throw new Error('Job data failed to save.');
				}
				else if (response.statusCode !== 200) {
					throw new Error(`Server reported ${response.statusCode} with: ${response.data}`);
				}
			}
			else {
				throw new Error(`Server reported ${response.statusCode} with no other data.`);
			}
		});
	}

	_start(): ChildDescriptor {
		const readyFile = joinPath(tmpdir(), `testingbot-${Date.now()}`);
		const child = this._makeChild(readyFile);
		const { process: childProcess, deferred: dfd } = child;
		let lastMessage: string;

		// Polling API is used because we are only watching for one file, so efficiency is not a big deal, and the
		// `fs.watch` API has extra restrictions which are best avoided
		watchFile(readyFile, { persistent: false, interval: 1007 }, function (current, previous) {
			if (Number(current.mtime) === Number(previous.mtime)) {
				// readyFile hasn't been modified, so ignore the event
				return;
			}

			unwatchFile(readyFile);
			dfd.resolve();
		});

		this._handles.push(
			on(childProcess.stderr, 'data', (data: string | Buffer) => {
				String(data).split('\n').forEach(message => {
					if (message.indexOf('INFO: ') === 0) {
						message = message.slice('INFO: '.length);
						// the tunnel produces a lot of repeating messages during setup when the status is pending;
						// deduplicate them for sanity
						if (
							message !== lastMessage &&
							message.indexOf('>> [') === -1 &&
							message.indexOf('<< [') === -1
						) {
							this.emit('status', message);
							lastMessage = message;
						}
					}
				});
			})
		);

		return child;
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
	 * @param {Object} environment a TestingBot environment descriptor
	 * @returns a normalized descriptor
	 * @private
	 */
	_normalizeEnvironment(environment: TestingBotEnvironment) {
		const browserMap: { [ key: string ]: string } = {
			googlechrome: 'chrome',
			iexplore: 'internet explorer'
		};

		return {
			browserName: browserMap[environment.name] || environment.name,
			descriptor: environment,
			platform: environment.platform,
			version: environment.version
		};
	}
}

mixin(TestingBotTunnel.prototype, {
	apiKey: process.env.TESTINGBOT_KEY,
	apiSecret: process.env.TESTINGBOT_SECRET,
	directory: joinPath(process.cwd(), 'testingbot'),
	executable: 'java',
	fastFailDomains: null,
	logFile: null,
	port: '4445',
	url: 'https://testingbot.com/downloads/testingbot-tunnel.zip',
	useCompression: false,
	useJettyProxy: true,
	useSquidProxy: true,
	useSsl: false,
	environmentUrl: 'https://api.testingbot.com/v1/browsers'
});
