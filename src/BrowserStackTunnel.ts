/**
 * @module digdug/BrowserStackTunnel
 */

import Tunnel from './Tunnel';
import {TunnelOptions} from './Tunnel';
import { join as joinPath } from 'path';
import { mixin, on } from './util';
import { chmodSync } from 'fs';
import { IResponse } from 'dojo/request';
import { DownloadOptions } from './Tunnel';
import { Url, parse as parseUrl } from 'url';
import JobState = digdug.JobState;
var request = require('dojo/request');
import DojoPromise = require('dojo/Promise');
import {ChildDescriptor} from './Tunnel';

export interface BrowserStackEnvironment {
	browser: string;
	os_version: string;
	browser_version: string;
	device: string;
	os: string;
}

/**
 * A BrowserStack tunnel.
 *
 * @constructor module:digdug/BrowserStackTunnel
 * @extends module:digdug/Tunnel
 */
export default class BrowserStackTunnel extends Tunnel {
	constructor(kwArgs: TunnelOptions) {
		super(mixin({
			servers: []
		}, kwArgs));
	}

	/**
	 * The BrowserStack access key. This will be initialized with the value of the `BROWSERSTACK_ACCESS_KEY`
	 * environment variable.
	 *
	 * @type {string}
	 * @default the value of the BROWSERSTACK_ACCESS_KEY environment variable
	 */
	accessKey: string;

	/**
	 * Whether or not to start the tunnel with only WebDriver support. Setting this value to `false` is not
	 * supported.
	 *
	 * @type {boolean}
	 * @default
	 */
	automateOnly: boolean;

	/**
	 * The URL of a service that provides a list of environments supported by BrowserStack.
	 */
	environmentUrl: string;

	/**
	 * If true, route all traffic via the local machine.
	 *
	 * @type {boolean}
	 * @default
	 */
	forceLocal: boolean;

	hostname: string;

	/**
	 * If true, any other tunnels running on the account will be killed when the tunnel is started.
	 *
	 * @type {boolean}
	 * @default
	 */
	killOtherTunnels: boolean;

	port: string;

	protocol: string;

	/**
	 * A list of server URLs that should be proxied by the tunnel. Only the hostname, port, and protocol are used.
	 *
	 * @type {string[]}
	 */
	servers: (Url | string)[];

	/**
	 * Skip verification that the proxied servers are online and responding at the time the tunnel starts.
	 *
	 * @type {boolean}
	 * @default
	 */
	skipServerValidation: boolean = true;

	/**
	 * The BrowserStack username. This will be initialized with the value of the `BROWSERSTACK_USERNAME`
	 * environment variable.
	 *
	 * @type {string}
	 * @default the value of the BROWSERSTACK_USERNAME environment variable
	 */
	username: string;

	get auth(): string {
		return `${ this.username }:${ this.accessKey }`;
	}

	get executable(): string {
		const extension = this.platform === 'win32' ? '.exe' : '';
		return `./BrowserStackLocal${ extension }`;
	}

	get extraCapabilities(): Object {
		const capabilities: { [ key: string ]: string } = {
			'browserstack.local': 'true'
		};

		if (this.tunnelId) {
			capabilities['browserstack.localIdentifier'] = this.tunnelId;
		}

		return capabilities;
	}

	get url(): string {
		const platform = this.platform;
		const architecture = this.architecture;
		let url = 'https://www.browserstack.com/browserstack-local/BrowserStackLocal-';

		if (platform === 'darwin' && architecture === 'x64') {
			url += `${ platform }-${ architecture }`;
		}
		else if (platform === 'win32') {
			url += platform;
		}
		else if (platform === 'linux' && (architecture === 'ia32' || architecture === 'x64')) {
			url += `${ platform }-${ architecture }`;
		}
		else {
			throw new Error(`${ platform }  on  ${ architecture } is not supported`);
		}

		url += '.zip';
		return url;
	}

	protected _postDownload(response: IResponse, options: DownloadOptions) {
		const executable = joinPath(this.directory, this.executable);
		return super._postDownload(response, options)
			.then(function () {
				chmodSync(executable, parseInt('0755', 8));
			});
	}

	protected _makeArgs (... values: string[]): string[] {
		const args: string[] = [
			this.accessKey,
			String(this.servers.map(function (server) {
				const serverUrl = (typeof server === 'string') ? parseUrl(server) : server;
				return [ serverUrl.hostname, serverUrl.port, serverUrl.protocol === 'https:' ? 1 : 0 ].join(',');
			}))
		];

		this.automateOnly && args.push('-onlyAutomate');
		this.forceLocal && args.push('-forcelocal');
		this.killOtherTunnels && args.push('-force');
		this.skipServerValidation && args.push('-skipCheck');
		this.tunnelId && args.push('-localIdentifier', this.tunnelId);
		this.verbose && args.push('-v');

		if (this.proxy) {
			const proxy = parseUrl(this.proxy);

			proxy.hostname && args.push('-proxyHost', proxy.hostname);
			proxy.port && args.push('-proxyPort', proxy.port);

			if (proxy.auth) {
				const auth: string[] = proxy.auth.split(':');
				args.push('-proxyUser', auth[0], '-proxyPass', auth[1]);
			}
		}

		return args;
	}

	sendJobState(jobId: string, data: JobState) {
		const payload = JSON.stringify({
			status: data.status || data.success ? 'completed' : 'error'
		});

		return request.put(`https://www.browserstack.com/automate/sessions/${jobId }.json`, {
			data: payload,
			handleAs: 'text',
			headers: {
				'Content-Length': Buffer.byteLength(payload, 'utf8'),
				'Content-Type': 'application/json'
			},
			password: this.accessKey,
			user: this.username,
			proxy: this.proxy
		}).then(function (response: IResponse) {
			if (response.statusCode >= 200 && response.statusCode < 300) {
				return true;
			}
			else {
				throw new Error(response.data || 'Server reported ' + response.statusCode + ' with no other data.');
			}
		});
	}

	protected _start(): ChildDescriptor {
		const child = this._makeChild();
		const { process: childProcess, deferred: dfd } = child;

		const handle = on(childProcess.stdout, 'data', (chunk: Buffer | string) => {
			chunk = String(chunk);
			if (typeof chunk === 'string') {
				var error = /\s*\*\*\* Error: (.*)$/m.exec(chunk);
				if (error) {
					handle.remove();
					dfd.reject(new Error(`The tunnel reported: ${ error[1] }`));
				}
				else if (chunk.indexOf('You can now access your local server(s) in our remote browser') > -1) {
					handle.remove();
					dfd.resolve();
				}
				else {
					var line = chunk.replace(/^\s+/, '').replace(/\s+$/, '');
					if (
						/^BrowserStackLocal v/.test(line) ||
						/^Connecting to BrowserStack/.test(line) ||
						/^Connected/.test(line)
					) {
						this.emit('status', line);
					}
				}
			}
		});

		return child;
	}

	protected _stop() {
		return new Promise((resolve) => {
			const childProcess = this._process;
			let exited = false;

			childProcess.once('exit', function (code: number) {
				exited = true;
				resolve(code);
			});
			childProcess.kill('SIGINT');

			// As of at least version 5.1, BrowserStackLocal spawns a secondary process. This is the one that needs to
			// receive the CTRL-C, but Node doesn't provide an easy way to get the PID of the secondary process, so we'll
			// just wait a few seconds, then kill the process if it hasn't ended cleanly.
			setTimeout(function () {
				if (!exited) {
					childProcess.kill('SIGTERM');
				}
			}, 5000);
		});
	}

	/**
	 * Attempt to normalize a BrowserStack described environment with the standard Selenium capabilities
	 *
	 * BrowserStack returns a list of environments that looks like:
	 *
	 * {
	 *     "browser": "opera",
	 *     "os_version": "Lion",
	 *     "browser_version":"12.15",
	 *     "device": null,
	 *     "os": "OS X"
	 * }
	 *
	 * @param {Object} environment a BrowserStack environment descriptor
	 * @returns a normalized descriptor
	 * @private
	 */
	protected _normalizeEnvironment(environment: BrowserStackEnvironment) {
		const platformMap: { [ key: string ]: Object | string } = {
			Windows: {
				'10': 'WINDOWS',
				'8.1': 'WIN8',
				'8': 'WIN8',
				'7': 'WINDOWS',
				'XP': 'XP'
			},

			'OS X': 'MAC'
		};

		const browserMap: { [ key: string ]: string } = {
			ie: 'internet explorer'
		};

		// Create the BS platform name for a given os + version
		let platform: any = platformMap[environment.os] || environment.os;
		if (typeof platform === 'object') {
			platform = platform[environment.os_version];
		}

		return {
			platform: platform,
			platformName: environment.os,
			platformVersion: environment.os_version,

			browserName: browserMap[environment.browser] || environment.browser,
			browserVersion: environment.browser_version,
			version: environment.browser_version,

			descriptor: environment
		};
	}
}

/**
 * Default values placed on the prototype
 */
mixin(BrowserStackTunnel.prototype, {
	accessKey: process.env.BROWSERSTACK_ACCESS_KEY,
	automatoOnly: true,
	directory: joinPath(__dirname, 'browserstack'),
	environmentUrl: 'https://www.browserstack.com/automate/browsers.json',
	forceLocal: false,
	hostname: 'hub.browserstack.com',
	killOtherTunnels: false,
	port: '443',
	protocol: 'https',
	skipServerValidation: true,
	username: process.env.BROWSERSTACK_USERNAME
});
