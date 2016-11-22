import { mixin, on } from './util';
import {TunnelOptions, default as Tunnel, DownloadOptions, NormalizedEnvironment, ChildDescriptor} from './Tunnel';
import { join as joinPath } from 'path';
import { parse as parseUrl, format as formatUrl } from 'url';
import { existsSync, chmodSync, watchFile, unwatchFile } from 'fs';
import { IResponse } from 'dojo/request';
import {Url} from 'url';
import request = require('dojo/request');
import { JobState } from './interfaces';
import { tmpdir } from 'os';
import DojoPromise = require('dojo/Promise');
import {INodeRequestOptions} from 'dojo/request/node';

export interface SauceLabsEnvironment {
	short_version: string;
	long_name: string;
	api_name: string;
	long_version: string;
	latest_stable_version: string;
	automation_backend: string;
	os: string;
}

/**
 * A Sauce Labs tunnel. This tunnel uses Sauce Connect 4 on platforms where it is supported, and Sauce Connect 3
 * on all other platforms.
 *
 * @constructor module:digdug/SauceLabsTunnel
 * @extends module:digdug/Tunnel
 */
export default class SauceLabsTunnel extends Tunnel {
	constructor(kwArgs: TunnelOptions) {
		super(mixin({
			directDomains: [],
			tunnelDomains: [],
			domainAuthentication: [],
			fastFailDomains: [],
			skipSslDomains: []
		}, kwArgs));
	}

	apiSecret: string;

	apiKey: string;

	/**
	 * A list of domains that should not be proxied by the tunnel on the remote VM.
	 *
	 * @type {string[]}
	 */
	directDomains: string[];

	/**
	 * A list of domains that will be proxied by the tunnel on the remote VM.
	 *
	 * @type {string[]}
	 */
	tunnelDomains: string[];

	/**
	 * A list of URLs that require additional HTTP authentication. Only the hostname, port, and auth are used.
	 * This property is only supported by Sauce Connect 4 tunnels.
	 *
	 * @type {string[]}
	 */
	domainAuthentication: string[];

	/**
	 * A list of regular expressions corresponding to domains whose connections should fail immediately if the VM
	 * attempts to make a connection to them.
	 *
	 * @type {string[]}
	 */
	fastFailDomains: string[];

	/**
	 * Allows the tunnel to also be used by sub-accounts of the user that started the tunnel.
	 *
	 * @type {boolean}
	 * @default
	 */
	isSharedTunnel: boolean;

	/**
	 * A filename where additional logs from the tunnel should be output.
	 *
	 * @type {string}
	 */
	logFile: string;

	/**
	 * Specifies the maximum log filesize before rotation, in bytes.
	 * This property is only supported by Sauce Connect 3 tunnels.
	 *
	 * @type {number}
	 */
	logFileSize: number;

	/**
	 * Log statistics about HTTP traffic every `logTrafficStats` milliseconds.
	 * This property is only supported by Sauce Connect 4 tunnels.
	 *
	 * @type {number}
	 * @default
	 */
	logTrafficStats: number;

	/**
	 * A filename where Sauce Connect stores its process information.
	 *
	 * @type {string}
	 */
	pidFile: string;

	/**
	 * An alternative URL for the Sauce REST API.
	 * This property is only supported by Sauce Connect 3 tunnels.
	 *
	 * @type {string}
	 */
	restUrl: string;

	/**
	 * SauceLabs Connect version to use when creating a tunnel
	 */
	scVersion: string;

	/**
	 * A list of domains that should not have their SSL connections re-encrypted when going through the tunnel.
	 *
	 * @type {string[]}
	 */
	skipSslDomains: string[];

	/**
	 * An additional set of options to use with the Squid proxy for the remote VM.
	 * This property is only supported by Sauce Connect 3 tunnels.
	 *
	 * @type {string}
	 */
	squidOptions: string;

	/**
	 * Whether or not to use the proxy defined at {@link module:digdug/Tunnel#proxy} for the tunnel connection
	 * itself.
	 *
	 * @type {boolean}
	 * @default
	 */
	useProxyForTunnel: boolean;

	/**
	 * Overrides the version of the VM created on Sauce Labs.
	 * This property is only supported by Sauce Connect 3 tunnels.
	 *
	 * @type {string}
	 */
	vmVersion: string;

	/**
	 * The URL of a service that provides a list of environments supported by Sauce Labs.
	 */
	environmentUrl: string;

	get auth() {
		return `${ this.username }:${ this.accessKey }`;
	}

	get executable() {
		const platform = this.platform === 'darwin' ? 'osx' : this.platform;
		const architecture = this.architecture;

		if (platform === 'osx' || platform === 'win32' || (platform === 'linux' && architecture === 'x64')) {
			const extension = platform === 'win32' ? '.exe' : '';
			return `./sc-${ this.scVersion }-${ platform }/bin/sc${ extension }`;
		}
		else {
			return 'java';
		}
	}

	get extraCapabilities() {
		const capabilities: { [ key: string ]: string } = {};

		if (this.tunnelId) {
			capabilities['tunnel-identifier'] = this.tunnelId;
		}

		return capabilities;
	}

	get isDownloaded() {
		return existsSync(this.executable === 'java' ?
			joinPath(this.directory, 'Sauce-Connect.jar') :
			joinPath(this.directory, this.executable)
		);
	}

	get url() {
		const platform = this.platform === 'darwin' ? 'osx' : this.platform;
		const architecture = this.architecture;
		const baseUrl = `https://saucelabs.com/downloads/sc-${ this.scVersion }-`;

		if (platform === 'osx' || platform === 'win32') {
			return `${ baseUrl }${ platform }.zip`;
		}
		else if (platform === 'linux' && architecture === 'x64') {
			return `${ baseUrl }${ platform }.tar.gz`;
		}

		// Sauce Connect 3 uses Java so should be able to run on other platforms that Sauce Connect 4 does not support
		return 'https://saucelabs.com/downloads/Sauce-Connect-3.1-r32.zip';
	}

	_postDownload(response: IResponse, options: DownloadOptions) {
		const executable = this.executable;
		return super._postDownload(response, options).then(() => {
			if (executable !== 'java') {
				chmodSync(joinPath(this.directory, executable), parseInt('0755', 8));
			}
		});
	}

	private _makeNativeArgs(proxy: Url): string[] {
		const args: string[] = [
			'-u', this.username,
			'-k', this.accessKey
		];

		if (proxy) {
			if (proxy.host) {
				args.push('-p', proxy.host);
			}

			if (proxy.auth) {
				args.push('-w', proxy.auth);
			}
		}

		if (this.domainAuthentication.length) {
			this.domainAuthentication.forEach(function (domain) {
				const domainUrl = parseUrl(domain);
				args.push('-a', `${ domainUrl.hostname }:${ domainUrl.port }:${ domainUrl.auth }`);
			});
		}

		this.logTrafficStats && args.push('-z', String(Math.floor(this.logTrafficStats / 1000)));

		if (this.verbose) {
			args.push('-v');
		}

		return args;
	}

	private _makeJavaArgs(proxy: Url): string[] {
		const args = [
			'-jar', 'Sauce-Connect.jar',
			this.username,
			this.accessKey
		];

		if (this.logFileSize) {
			args.push('-g', String(this.logFileSize));
		}

		if (this.squidOptions) {
			args.push('-S', this.squidOptions);
		}

		if (this.verbose) {
			args.push('-d');
		}

		if (proxy) {
			proxy.hostname && args.push('-p', proxy.hostname + (proxy.port ? ':' + proxy.port : ''));

			if (proxy.auth) {
				const auth = proxy.auth.split(':');
				args.push('-u', auth[0], '-X', auth[1]);
			}
		}

		return args;
	}

	_makeArgs(readyFile: string) {
		const proxy: Url = this.proxy ? parseUrl(this.proxy) : undefined;
		const args = this.executable === 'java' ? this._makeJavaArgs(proxy) : this._makeNativeArgs(proxy);

		args.push(
			'-P', this.port,
			'-f', readyFile
		);

		this.directDomains.length && args.push('-D', this.directDomains.join(','));
		this.tunnelDomains.length && args.push('-t', this.tunnelDomains.join(','));
		this.fastFailDomains.length && args.push('-F', this.fastFailDomains.join(','));
		this.isSharedTunnel && args.push('-s');
		this.logFile && args.push('-l', this.logFile);
		this.pidFile && args.push('--pidfile', this.pidFile);
		this.restUrl && args.push('-x', this.restUrl);
		this.skipSslDomains.length && args.push('-B', this.skipSslDomains.join(','));
		this.tunnelId && args.push('-i', this.tunnelId);
		this.useProxyForTunnel && args.push('-T');
		this.vmVersion && args.push('-V', this.vmVersion);

		return args;
	}

	sendJobState(jobId: string, data: JobState): Promise<void> {
		const url = parseUrl(this.restUrl || 'https://saucelabs.com/rest/v1/');
		url.auth = `${this.username}:${this.accessKey}`;
		url.pathname += `${this.username}/jobs/${jobId}`;

		const payload = JSON.stringify({
			build: data.buildId,
			'custom-data': data.extra,
			name: data.name,
			passed: data.success,
			'public': data.visibility,
			tags: data.tags
		});

		const options: INodeRequestOptions = {
			data: payload,
			headers: {
				'Content-Length': String(Buffer.byteLength(payload, 'utf8')),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			password: this.apiSecret,
			user: this.apiKey,
			proxy: this.proxy
		};

		return request.put(formatUrl(url), options).then(function (response: IResponse) {
			if (response.data) {
				const data = JSON.parse(response.data);

				if (data.error) {
					throw new Error(data.error);
				}

				if (response.statusCode !== 200) {
					throw new Error(`Server reported ${ response.statusCode } with: ${ response.data }`);
				}
			}
			else {
				throw new Error(`Server reported ${ response.statusCode } with no other data.`);
			}
		});
	}

	_start(): ChildDescriptor {
		type MessageHandler = (message: string) => void;

		const readStatus: MessageHandler = (message: string): void => {
			if (
				message &&
				message.indexOf('Please wait for') === -1 &&
				message.indexOf('Sauce Connect is up') === -1 &&
				message.indexOf('Sauce Connect') !== 0 &&
				message.indexOf('Using CA certificate bundle') === -1 &&
				// Sauce Connect 3
				message.indexOf('You may start your tests') === -1
			) {
				this.emit('status', message);
			}
		};

		const readStartupMessage: MessageHandler = (message: string): void => {
			function reject(message: string) {
				if (dfd.promise.state === DojoPromise.State.PENDING) {
					dfd.reject(new Error(message));
				}
				return true;
			}

			// These messages contain structured data we can try to consume
			if (message.indexOf('Error: response: ') === 0) {
				try {
					const errorMatch = /(\{[\s\S]*\})/.exec(message);
					if (errorMatch) {
						const error = JSON.parse(errorMatch[1]);
						reject(error.error);
						return;
					}
				}
				catch (error) {
					// It seems parsing did not work so well; fall through to the normal error handler
				}
			}

			if (message.indexOf('Error: ') === 0) {
				// skip known warnings
				if (
					/open file limit \d+ is too low/.test(message) ||
					/Sauce Labs recommends setting it/.test(message) ||
					/HTTP response code indicated failure/.test(message)
				) {
					return;
				}
				reject(message.slice('Error: '.length));
				return;
			}

			readStatus(message);
		};

		const readRunningMessage: MessageHandler = (message: string): void => {
			// Sauce Connect 3
			if (message.indexOf('Problem connecting to Sauce Labs REST API') > -1) {
				// It will just keep trying and trying and trying for a while, but it is a failure, so force it
				// to stop
				childProcess.kill('SIGTERM');
			}

			readStatus(message);
		};

		const readyFile = joinPath(tmpdir(), 'saucelabs-' + Date.now());
		const child = this._makeChild(readyFile);
		const { process: childProcess, deferred: dfd } = child;
		let readMessage: MessageHandler = readStartupMessage;

		// Polling API is used because we are only watching for one file, so efficiency is not a big deal, and the
		// `fs.watch` API has extra restrictions which are best avoided
		watchFile(readyFile, { persistent: false, interval: 1007 }, (current, previous) => {
			if (Number(current.mtime) === Number(previous.mtime)) {
				// readyFile hasn't been modified, so ignore the event
				return;
			}

			unwatchFile(readyFile);

			// We have to watch for errors until the tunnel has started successfully at which point we only want to
			// watch for status messages to emit
			readMessage = readStatus;

			dfd.resolve();
		});

		dfd.promise.then(function() {
			readMessage = readRunningMessage;
		});

		// Sauce Connect exits with a zero status code when there is a failure, and outputs error messages to
		// stdout, like a boss. Even better, it uses the "Error:" tag for warnings.
		this._handles.push(on(childProcess.stdout, 'data', function (chunk: Buffer | string) {
			String(chunk).split('\n').forEach(function (message: string) {
				// Get rid of the date/time prefix on each message
				const delimiter = message.indexOf(' - ');
				if (delimiter > -1) {
					message = message.slice(delimiter + 3);
				}
				readMessage(message.trim());
			});
		}));

		return child;
	}

	/**
	 * Attempt to normalize a SauceLabs described environment with the standard Selenium capabilities
	 *
	 * SauceLabs returns a list of environments that looks like:
	 *
	 * {
	 *     "short_version": "25",
	 *     "long_name": "Firefox",
	 *     "api_name": "firefox",
	 *     "long_version": "25.0b2.",
	 *     "latest_stable_version": "",
	 *     "automation_backend": "webdriver",
	 *     "os": "Windows 2003"
	 * }
	 *
	 * @param {Object} environment a SauceLabs environment descriptor
	 * @returns a normalized descriptor
	 * @private
	 */
	_normalizeEnvironment(environment: SauceLabsEnvironment): NormalizedEnvironment {
		const windowsMap: { [ key: string ]: string } = {
			'Windows 2003': 'Windows XP',
			'Windows 2008': 'Windows 7',
			'Windows 2012': 'Windows 8',
			'Windows 2012 R2': 'Windows 8.1',
			'Windows 10': 'Windows 10'
		};

		const browserMap: { [ key: string ]: string } = {
			'microsoftedge': 'MicrosoftEdge'
		};

		let os = environment.os;
		let platformName = os;
		let platformVersion: string;
		if (os.indexOf('Windows') === 0) {
			os = windowsMap[os] || os;
			platformName = 'Windows';
			platformVersion = os.slice('Windows '.length);
		}
		else if (os.indexOf('Mac') === 0) {
			platformName = 'OS X';
			platformVersion = os.slice('Mac '.length);
		}

		return {
			platform: platformName + (platformVersion ? ' ' + platformVersion : ''),
			platformName: platformName,
			platformVersion: platformVersion,

			browserName: browserMap[environment.api_name] || environment.api_name,
			browserVersion: environment.short_version,
			version: environment.short_version,

			descriptor: environment
		};
	}
}

mixin(SauceLabsTunnel.prototype, {
	accessKey: process.env.SAUCE_ACCESS_KEY,
	directory: joinPath(__dirname, 'saucelabs'),
	environmentUrl: 'https://saucelabs.com/rest/v1/info/platforms/webdriver',
	isSharedTunnel: false,
	logFile: null,
	logFileSize: null,
	logTrafficStats: 0,
	pidFile: null,
	restUrl: null,
	scVersion: '4.3.14',
	skipSslDomains: null,
	squidOptions: null,
	username: process.env.SAUCE_USERNAME,
	useProxyForTunnel: false,
	vmVersion: null
});
