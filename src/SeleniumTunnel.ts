/**
 * @module digdug/SeleniumTunnel
 */

import DojoPromise = require('dojo/Promise');
import request = require('dojo/request');
import mkdirp = require('mkdirp');
import { mixin, on } from './util';
import Tunnel, { DownloadOptions, ChildDescriptor } from './Tunnel';
import { join as joinPath } from 'path';
import { existsSync, writeFile } from 'fs';
import { IResponse } from 'dojo/request';
import ChromeConfig from './configs/ChromeConfig';
import IeConfig from './configs/IeConfig';
import FirefoxConfig from './configs/FirefoxConfig';
import SeleniumConfig from './configs/SeleniumConfig';
import { KwArgs } from './interfaces';

/**
 * used to provide overrides for a driver
 *
 * {
 * 	name: 'firefox',
 * 	version: '0.8.0',
 * 	baseUrl: 'https://github.com/mozilla/geckodriver/releases/download'
 * }
 *
 * The above example will use the FirefoxConfig and override default properties with the provided values
 */
export interface DriverProperties extends KwArgs {
	name: string;
}

/**
 * valid ways of referring to a driver file (e.g. ChromeDriver)
 */
export type DriverDescriptors = 'chrome' | 'ie' | 'firefox' | DriverProperties | DriverFile;

/**
 * used to provide overrides for Selenium
 */
export interface SeleniumProperties {
	version: string;
	baseUrl?: string;
}

/**
 * Selenium can be configured using explicit properties (SeleniumProperties) or a simple version string
 */
export type SeleniumDescriptor = string | SeleniumProperties;

/**
 * Additional options that cannot be hard-coded for tunnels that download multiple files & archives
 */
export interface MultifileDownloadOptions extends DownloadOptions {
	executable: string;
	dontExtract?: boolean;
}

/**
 * A remote file
 */
export interface RemoteFile {
	dontExtract?: boolean;
	executable: string;
	url: string;
}

/**
 * A remove driver file
 */
export interface DriverFile extends RemoteFile {
	seleniumProperty: string;
}

export type DriverFileConstructor = { new(config?: KwArgs): DriverFile };
export type DriverMap = { [ key: string ]: DriverFileConstructor };

export default class SeleniumTunnel extends Tunnel {
	driverNameMap: DriverMap;

	/**
	 * Additional arguments to send to Selenium standalone on start
	 *
	 * @type {Array}
	 */
	seleniumArgs: string[];

	/**
	 * The desired selenium drivers to install. This is a list of driver definitions that may either be a basic string
	 * or an object.
	 *
	 * example:
	 * 	[
	 * 		'chrome',
	 * 		{
	 * 			name: 'firefox',
	 * 			version: '0.8.0',
	 * 			baseUrl: 'https://github.com/mozilla/geckodriver/releases/download'
	 * 		}
	 * 	]
	 *
	 * @type {Array}
	 * @default [ 'chrome' ]
	 */
	seleniumDrivers: DriverDescriptors[];

	/**
	 * The desired version of selenium to install. This can be defined using a version number or an object containing a
	 * version number and baseUrl.
	 *
	 * example:
	 * 	{
	 * 		version: '2.53.0',
	 * 		baseUrl: 'https://selenium-release.storage.googleapis.com'
	 * 	}
	 *
	 * @type {string|object}
	 * @default
	 */
	seleniumVersion: SeleniumDescriptor;

	/**
	 * Timeout for communicating with Selenium Services
	 */
	serviceTimeout: number;

	get directory() {
		return joinPath(process.cwd(), 'selenium-standalone');
	}

	get executable() {
		return 'java';
	}

	get isDownloaded() {
		const directory = this.directory;
		return this._getConfigs().every(function (config) {
			return existsSync(joinPath(directory, config.executable));
		});
	}

	download(forceDownload: boolean = false): DojoPromise<any> {
		if (!forceDownload && this.isDownloaded) {
			return DojoPromise.resolve(null);
		}

		const tasks = this._getConfigs().map((config) => {
			const executable = config.executable;
			const path = joinPath(this.directory, executable);

			if (existsSync(path)) {
				return DojoPromise.resolve(null);
			}

			const options: DownloadOptions = <any> mixin({}, SeleniumTunnel.prototype, this, {
				url: config.url,
				executable: executable,
				dontExtract: !!config.dontExtract
			});

			return this._downloadFile(options);
		});

		return DojoPromise.all(tasks);
	}

	sendJobState(): Promise<void> {
		// This is a noop for Selenium
		return Promise.resolve<void>();
	}

	private _getConfigs(): RemoteFile[] {
		const configs: RemoteFile[] = this._getDriverConfigs();
		configs.push(new SeleniumConfig(this.seleniumVersion));
		return configs;
	}

	private _getDriverConfigs(): DriverFile[] {
		return this.seleniumDrivers.map((data: DriverDescriptors) => {
			if (typeof data === 'string') {
				const _Constructor: DriverFileConstructor = this.driverNameMap[data];
				return new _Constructor();
			}
			if (typeof data === 'object' && (<DriverProperties> data).name) {
				const name: string = (<DriverProperties> data).name;
				const _Constructor: DriverFileConstructor = this.driverNameMap[name];
				return new _Constructor(data);
			}
			return <DriverFile> data;
		});
	}

	protected _makeArgs(): string[] {
		const directory = this.directory;
		const seleniumConfig = new SeleniumConfig(this.seleniumVersion);
		const driverConfigs = this._getDriverConfigs();
		const args = [
			'-jar',
			joinPath(this.directory, seleniumConfig.executable),
			'-port',
			this.port
		];

		driverConfigs.reduce(function (args, config) {
			const file = joinPath(directory, config.executable);
			args.push(`-D${ config.seleniumProperty }=${ file }`);
			return args;
		}, args);

		if (this.seleniumArgs) {
			args.splice(args.length, 0, ... this.seleniumArgs);
		}

		if (this.verbose) {
			args.push('-debug');
			console.log('starting with arguments: ', args.join(' '));
		}

		return args;
	}

	protected _postDownload(response: IResponse, options: MultifileDownloadOptions) {
		this.emit('postdownload', options.url);
		if (options.dontExtract) {
			return this._writeFile(response.data, options);
		}
		else {
			return this._decompressData(response.data, options);
		}
	}

	protected _start(): ChildDescriptor {
		const childHandle = this._makeChild();
		const { deferred: dfd, process: child } = childHandle;
		const handle = on(child.stderr, 'data', (data: string | Buffer) => {
			// Selenium recommends that we poll the hub looking for a status response
			// https://github.com/seleniumhq/selenium-google-code-issue-archive/issues/7957
			// We're going against the recommendation here for a few reasons
			// 1. There's no default pid or log to look for errors to provide a specific failure
			// 2. Polling on a failed server start could leave us with an unpleasant wait
			// 3. Just polling a selenium server doesn't guarantee it's the server we started
			// 4. This works pretty well
			if (String(data).indexOf('Selenium Server is up and running') > -1) {
				dfd.resolve();
			}
			if (this.verbose) {
				console.log(data);
			}
		});
		const removeHandle = handle.remove.bind(handle);

		dfd.promise.then(removeHandle, removeHandle);

		return childHandle;
	}

	protected _stop() {
		const url = `http://${ this.hostname }:${ this.port }/selenium-server/driver/?cmd=shutDownSeleniumServer`;
		const options = {
			timeout: this.serviceTimeout,
			handleAs: 'text'
		};
		return request(url, options).then((response) => {
			const text = response.data.toString();
			if (text !== 'OKOK') {
				throw new Error('Tunnel not shut down');
			}
			return super._stop();
		});
	}

	private _writeFile(data: any, options: MultifileDownloadOptions) {
		return new Promise(function (resolve, reject) {
			const target = joinPath(options.directory, options.executable);

			mkdirp(options.directory, function (error) {
				if (error) {
					reject(error);
					return;
				}

				writeFile(target, data, function (error) {
					if (error) {
						reject(error);
						return;
					}

					resolve();
				});
			});
		});
	}
}

mixin(SeleniumTunnel.prototype, {
	driverNameMap: Object.freeze({
		chrome: ChromeConfig,
		ie: IeConfig,
		firefox: FirefoxConfig
	}),
	seleniumDrivers: Object.freeze([ 'chrome' ])
});
