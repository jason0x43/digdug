/**
 * @module digdug/Tunnel
 */

import DojoPromise = require('dojo/Promise');
import decompress = require('decompress');
import Evented = require('dojo/Evented');
import { mixin, on } from './util';
import { format as formatUrl, Url } from 'url';
import { existsSync } from 'fs';
import { join as joinPath } from 'path';
import * as sendRequest from 'dojo/request/node';
import { IRequestError, IResponse } from 'dojo/request';
import { spawn, ChildProcess } from 'child_process';
import { Deferred } from 'dojo/Promise';
import { Handle, JobState } from './interfaces';

// TODO: Spawned processes are not getting cleaned up if there is a crash

/**
 * Clears an array of remover handles.
 *
 * @param {Handle[]} handles
 * @private
 */

function clearHandles(handles: Handle[]): void {
	let handle: Handle;

	while (handle = handles.pop()) {
		handle.remove();
	}
}

/**
 * Creates a new function that emits an event of type `type` on `target` every time the returned function is called.
 *
 * @param {module:dojo/Evented} target A target event emitter.
 * @param {string} type The type of event to emit.
 * @returns {Function} The function to call to trigger an event.
 * @private
 */
function proxyEvent(target: Evented, type: string) {
	return function (data: any) {
		target.emit(type, data);
	};
}

export interface TunnelOptions {
	[ key: string ]: any;
}

export interface SpawnOptions {
	cwd: string;
	env: string;
	[ key: string ]: string;
}

export interface DownloadOptions {
	directory: string;
	proxy: string;
	url: string;
}

export interface ChildDescriptor {
	process: ChildProcess;
	deferred: Deferred<any>;
}

export interface NormalizedEnvironment {
	browserName: string;
	browserVersion?: string;
	descriptor: Object;
	platform: string;
	platformName?: string;
	platformVersion?: string;
	version: string;
}

/**
 * A Tunnel is a mechanism for connecting to a WebDriver service provider that securely exposes local services for
 * testing within the service provider’s network.
 *
 * @constructor module:digdug/Tunnel
 * @param {Object} kwArgs A map of properties that should be set on the new instance.
 */

export default class Tunnel extends Evented implements Url, DownloadOptions {
	constructor(kwArgs?: TunnelOptions) {
		super();
		mixin(this, kwArgs);
	}

	environmentUrl: string;

	accessKey: string;

	username: string;

	/**
	 * The architecture the tunnel will run against. This information is automatically retrieved for the current
	 * system at runtime.
	 *
	 * @type {string}
	 */
	architecture: string;

	/**
	 * An HTTP authorization string to use when initiating connections to the tunnel. This value of this property is
	 * defined by Tunnel subclasses.
	 *
	 * @type {string}
	 */
	auth: string;

	/**
	 * The directory where the tunnel software will be extracted. If the directory does not exist, it will be
	 * created. This value is set by the tunnel subclasses.
	 *
	 * @type {string}
	 */
	directory: string;

	/**
	 * The executable to spawn in order to create a tunnel. This value is set by the tunnel subclasses.
	 *
	 * @type {string}
	 */
	executable: string;

	/**
	 * The host on which a WebDriver client can access the service provided by the tunnel. This may or may not be
	 * the host where the tunnel application is running.
	 *
	 * @type {string}
	 * @default
	 */
	hostname: string;

	/**
	 * Whether or not the tunnel is currently running.
	 *
	 * @type {boolean}
	 * @readonly
	 */
	isRunning: boolean;

	/**
	 * Whether or not the tunnel is currently starting up.
	 *
	 * @type {boolean}
	 * @readonly
	 */
	isStarting: boolean;

	/**
	 * Whether or not the tunnel is currently stopping.
	 *
	 * @type {boolean}
	 * @readonly
	 */
	isStopping: boolean;

	/**
	 * The path that a WebDriver client should use to access the service provided by the tunnel.
	 *
	 * @type {string}
	 * @default
	 */
	pathname: string;

	/**
	 * The operating system the tunnel will run on. This information is automatically retrieved for the current
	 * system at runtime.
	 *
	 * @type {string}
	 */
	platform: string;

	/**
	 * The local port where the WebDriver server should be exposed by the tunnel.
	 *
	 * @type {number}
	 * @default
	 */
	port: string;

	/**
	 * The protocol (e.g., 'http') that a WebDriver client should use to access the service provided by the tunnel.
	 *
	 * @type {string}
	 * @default
	 */
	protocol: string;

	/**
	 * The URL of a proxy server for the tunnel to go through. Only the hostname, port, and auth are used.
	 *
	 * @type {string}
	 */
	proxy: string;

	/**
	 * A unique identifier for the newly created tunnel.
	 *
	 * @type {string=}
	 */
	tunnelId: string;

	/**
	 * The URL where the tunnel software can be downloaded.
	 *
	 * @type {string}
	 */
	url: string;

	/**
	 * Whether or not to tell the tunnel to provide verbose logging output.
	 *
	 * @type {boolean}
	 * @default
	 */
	verbose: boolean;

	protected  _startTask: DojoPromise<ChildDescriptor>;
	protected _handles: Handle[] = null;
	protected _process: ChildProcess = null;

	/**
	 * The URL that a WebDriver client should used to interact with this service.
	 *
	 * @member {string} clientUrl
	 * @memberOf module:digdug/Tunnel#
	 * @type {string}
	 * @readonly
	 */
	get clientUrl(): string {
		return formatUrl(this);
	}

	/**
	 * A map of additional capabilities that need to be sent to the provider when a new session is being created.
	 *
	 * @member {string} extraCapabilities
	 * @memberOf module:digdug/Tunnel#
	 * @type {Object}
	 * @readonly
	 */
	get extraCapabilities(): Object {
		return {};
	}

	/**
	 * Whether or not the tunnel software has already been downloaded.
	 *
	 * @member {string} isDownloaded
	 * @memberOf module:digdug/Tunnel#
	 * @type {boolean}
	 * @readonly
	 */
	get isDownloaded(): boolean {
		return existsSync(joinPath(this.directory, this.executable));
	}

	/**
	 * Downloads and extracts the tunnel software if it is not already downloaded.
	 *
	 * This method can be extended by implementations to perform any necessary post-processing, such as setting
	 * appropriate file permissions on the downloaded executable.
	 *
	 * @param {boolean} forceDownload Force downloading the software even if it already has been downloaded.
	 * @returns {Promise.<void>} A promise that resolves once the download and extraction process has completed.
	 */
	download(forceDownload: boolean = false): DojoPromise<any> {
		if (!forceDownload && this.isDownloaded) {
			return DojoPromise.resolve(null);
		}

		return this._downloadFile(this);
	}

	protected _downloadFile(options: DownloadOptions): DojoPromise<any> {
		return new DojoPromise<void>((resolve, reject, progress, setCanceler) => {
			setCanceler(function (reason) {
				request && request.cancel(reason);
			});

			const request = sendRequest(options.url, { proxy: options.proxy });
			return request.then((response: IResponse) => {
					resolve(this._postDownload(response, options));
				},
				function (error: IRequestError) {
					reject(
						(error.response && error.response.statusCode >= 400) ?
							new Error('Download server returned status code ' + error.response.statusCode) :
							error
					);
				},
				(info) => {
					this.emit('filedownloadprogress', {
						url: options.url,
						progress: info
					});
					progress(info);
				}
			);
		});
	}

	protected _postDownload(response: IResponse, options: DownloadOptions) {
		this.emit('postdownload', options.url);
		return this._decompressData(response.data, options);
	}

	protected _decompressData(file: Buffer, options: DownloadOptions): Promise<any> {
		return decompress(file, options.directory);
	}

	/**
	 * Creates the list of command-line arguments to be passed to the spawned tunnel. Implementations should
	 * override this method to provide the appropriate command-line arguments.
	 *
	 * Arguments passed to {@link module:digdug/Tunnel#_makeChild} will be passed as-is to this method.
	 *
	 * @protected
	 * @returns {string[]} A list of command-line arguments.
	 */
	protected _makeArgs(... values: string[]): string[];
	protected _makeArgs(): string[] {
		return [];
	}

	/**
	 * Creates a newly spawned child process for the tunnel software. Implementations should call this method to
	 * create the tunnel process.
	 *
	 * Arguments passed to this method will be passed as-is to {@link module:digdug/Tunnel#_makeArgs} and
	 * {@link module:digdug/Tunnel#_makeOptions}.
	 *
	 * @protected
	 * @returns {{ process: module:ChildProcess, deferred: module:dojo/Deferred }}
	 * An object containing a newly spawned Process and a Deferred that will be resolved once the tunnel has started
	 * successfully.
	 */
	protected _makeChild(... values: string[]): ChildDescriptor {
		function handleChildExit() {
			if (dfd.promise.state === DojoPromise.State.PENDING) {
				const message = 'Tunnel failed to start: ' + (errorMessage || ('Exit code: ' + exitCode));
				dfd.reject(new Error(message));
			}
		}

		const command = this.executable;
		const args = this._makeArgs(... values);
		const options = this._makeOptions(... values);

		const dfd = new DojoPromise.Deferred(function (reason) {
			child.kill('SIGINT');
			return new Promise(function (_unused, reject) {
				child.once('exit', function () {
					reject(reason);
				});
			});
		});
		const child = spawn(command, args, options);

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');

		// Detect and reject on common errors, but only until the promise is fulfilled, at which point we should
		// no longer be managing any events since it means the process has started successfully and is underway
		let errorMessage = '';
		let exitCode: number = null;
		let stderrClosed = false;

		const handles = [
			on(child, 'error', dfd.reject.bind(dfd)),
			on(child.stderr, 'data', function (data) {
				errorMessage += data;
			}),
			on(child, 'exit', function (code: number) {
				exitCode = code;
				if (stderrClosed) {
					handleChildExit();
				}
			}),
			// stderr might still have data in buffer at the time the exit event is sent, so we have to store data
			// from stderr and the exit code and reject only once stderr closes
			on(child.stderr, 'close', function () {
				stderrClosed = true;
				if (exitCode !== null) {
					handleChildExit();
				}
			})
		];

		dfd.promise.then(function () {
			clearHandles(handles);
		}).catch(function () {
			clearHandles(handles);
		});

		return {
			process: child,
			deferred: dfd
		};
	}

	/**
	 * Creates the set of options to use when spawning the tunnel process. Implementations should override this
	 * method to provide the appropriate options for the tunnel software.
	 *
	 * Arguments passed to {@link module:digdug/Tunnel#_makeChild} will be passed as-is to this method.
	 *
	 * @protected
	 * @returns {Object} A set of options matching those provided to Node.js {@link module:child_process.spawn}.
	 */
	protected _makeOptions(... values: string[]): SpawnOptions;
	protected _makeOptions(): SpawnOptions {
		return {
			cwd: this.directory,
			env: process.env
		};
	}

	/**
	 * Sends information about a job to the tunnel provider.
	 *
	 * @param {string} jobId The job to send data about. This is usually a session ID.
	 * @param {JobState} data Data to send to the tunnel provider about the job.
	 * @returns {Promise.<void>} A promise that resolves once the job state request is complete.
	 */
	sendJobState(jobId: string, data: JobState): Promise<void>;
	sendJobState(): Promise<void> {
		return Promise.reject(new Error('Job state is not supported by this tunnel.'));
	}

	/**
	 * Starts the tunnel, automatically downloading dependencies if necessary.
	 *
	 * @returns {Promise.<void>} A promise that resolves once the tunnel has been established.
	 */
	start() {
		if (this.isRunning) {
			throw new Error('Tunnel is already running');
		}
		else if (this.isStopping) {
			throw new Error('Previous tunnel is still terminating');
		}
		else if (this.isStarting) {
			return this._startTask;
		}

		this.isStarting = true;

		this._startTask = this
			.download()
			.then(null, null, (progress) => {
				this.emit('downloadprogress', progress);
			})
			.then(() => {
				this._handles = [];
				return this._start();
			})
			.then((child) => {
				const childProcess = this._process = child.process;
				this._handles.push(
					on(childProcess.stdout, 'data', proxyEvent(this, 'stdout')),
					on(childProcess.stderr, 'data', proxyEvent(this, 'stderr')),
					on(childProcess, 'exit', () => {
						this.isStarting = false;
						this.isRunning = false;
					})
				);
				return child.deferred.promise;
			});

		this._startTask.then(() => {
			this._startTask = null;
			this.isStarting = false;
			this.isRunning = true;
			this.emit('status', 'Ready');
		}, (error: Error) => {
			this._startTask = null;
			this.isStarting = false;
			this.emit('status', error.name === 'CancelError' ? 'Start cancelled' : 'Failed to start tunnel');
		});

		return this._startTask;
	}

	/**
	 * This method provides the implementation that actually starts the tunnel and any other logic for emitting
	 * events on the Tunnel based on data passed by the tunnel software.
	 *
	 * The default implementation that assumes the tunnel is ready for use once the child process has written to
	 * `stdout` or `stderr`. This method should be reimplemented by other tunnel launchers to implement correct
	 * launch detection logic.
	 *
	 * @protected
	 * @returns {{ process: module:ChildProcess, deferred: module:dojo/Deferred }}
	 * An object containing a reference to the child process, and a Deferred that is resolved once the tunnel is
	 * ready for use. Normally this will be the object returned from a call to `Tunnel#_makeChild`.
	 */
	protected _start(): ChildDescriptor {
		function resolve() {
			clearHandles(handles);
			dfd.resolve();
		}

		const childHandle = this._makeChild();
		const child = childHandle.process;
		const dfd = childHandle.deferred;
		const handles = [
			on(child.stdout, 'data', resolve),
			on(child.stderr, 'data', resolve),
			on(child, 'error', function (error) {
				clearHandles(handles);
				dfd.reject(<any> error);
			})
		];

		return childHandle;
	}

	/**
	 * Stops the tunnel.
	 *
	 * @returns {Promise.<integer>}
	 * A promise that resolves to the exit code for the tunnel once it has been terminated.
	 */
	stop(): Promise<number> {
		if (this.isStopping) {
			throw new Error('Tunnel is already terminating');
		}
		else if (this.isStarting) {
			this._startTask.cancel();
			return;
		}
		else if (!this.isRunning) {
			throw new Error('Tunnel is not running');
		}

		this.isRunning = false;
		this.isStopping = true;

		return this._stop().then((returnValue: number) => {
			clearHandles(this._handles);
			this._process = this._handles = null;
			this.isRunning = this.isStopping = false;
			return returnValue;
		}, (error) => {
			this.isRunning = true;
			this.isStopping = false;
			throw error;
		});
	}

	/**
	 * This method provides the implementation that actually stops the tunnel.
	 *
	 * The default implementation that assumes the tunnel has been closed once the child process has exited. This
	 * method should be reimplemented by other tunnel launchers to implement correct shutdown logic, if necessary.
	 *
	 * @protected
	 * @returns {Promise.<number>} A promise that resolves once the tunnel has shut down.
	 */
	protected _stop(): Promise<number> {
		return new Promise((resolve) => {
			const childProcess = this._process;

			childProcess.once('exit', resolve);
			childProcess.kill('SIGINT');
		});
	}

	/**
	 * Get a list of environments available on the service.
	 *
	 * This method should be overridden and use a specific implementation that returns normalized
	 * environments from the service. E.g.
	 *
	 * {
	 *     browserName: 'firefox',
	 *     version: '12',
	 *     platform: 'windows',
	 *     descriptor: { <original returned environment> }
	 * }
	 *
	 * @returns An object containing the response and helper functions
	 */
	getEnvironments(): Promise<NormalizedEnvironment[]> {
		if (!this.environmentUrl) {
			return Promise.resolve([]);
		}

		return sendRequest(this.environmentUrl, {
			password: this.accessKey,
			user: this.username,
			proxy: this.proxy
		}).then((response: IResponse) => {
			if (response.statusCode >= 200 && response.statusCode < 400) {
				return JSON.parse(response.data.toString()).map(this._normalizeEnvironment, this);
			}
			else {
				throw new Error('Server replied with a status of ' + response.statusCode);
			}
		});
	}

	/**
	 * Normalizes a specific Tunnel environment descriptor to a general form. To be overriden by a child implementation.
	 * @param environment an environment descriptor specific to the Tunnel
	 * @returns a normalized environment
	 * @protected
	 */
	protected _normalizeEnvironment(environment: Object): NormalizedEnvironment {
		return <NormalizedEnvironment> environment;
	}
}

/**
 * Default values placed on the prototype
 */
mixin(Tunnel.prototype, {
	architecture: process.arch,
	auth: null,
	directory: null,
	executable: null,
	hostname: 'localhost',
	isRunning: false,
	isStarting: false,
	isStopping: false,
	pathname: '/wd/hub/',
	platform: process.platform,
	port: '4444',
	protocol: 'http',
	proxy: null,
	tunnelId: null,
	url: null,
	verbose: false
});
