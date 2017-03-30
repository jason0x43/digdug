import Evented from 'dojo-core/Evented';
import { EventObject, EventTargettedObject } from 'dojo-interfaces/core';
import { createCompositeHandle, mixin } from 'dojo-core/lang';
import { Handle } from 'dojo-core/interfaces';
import Task, { State } from 'dojo-core/async/Task';
import sendRequest, { ResponsePromise, Response } from 'dojo-core/request';
import { NodeRequestOptions } from 'dojo-core/request/node';
import { spawn, ChildProcess } from 'child_process';
import { format as formatUrl, Url } from 'url';
import { fileExists, isRequestError, on } from './util';
import { JobState } from './interfaces';
import decompress = require('decompress');

// TODO: Spawned processes are not getting cleaned up if there is a crash

/**
 * A Tunnel is a mechanism for connecting to a WebDriver service provider that securely exposes local services for
 * testing within the service provider’s network.
 */
export default class Tunnel extends Evented implements TunnelProperties, Url {
	constructor(options?: TunnelOptions) {
		super();
		mixin(this, {
			architecture: process.arch,
			hostname: 'localhost',
			pathname: '/wd/hub/',
			platform: process.platform,
			port: 4444,
			protocol: 'http',
			verbose: false
		}, options);
	}

	/**
	 * Part of the tunnel has been downloaded from the server.
	 *
	 * @event module:digdug/Tunnel#downloadprogress
	 * @type {Object}
	 * @property {number} received The number of bytes received so far.
	 * @property {number} total The total number of bytes to download.
	 */

	/**
	 * A chunk of raw string data output by the tunnel software to stdout.
	 *
	 * @event module:digdug/Tunnel#stdout
	 * @type {string}
	 */

	/**
	 * A chunk of raw string data output by the tunnel software to stderr.
	 *
	 * @event module:digdug/Tunnel#stderr
	 * @type {string}
	 */

	/**
	 * Information about the status of the tunnel setup process that is suitable for presentation to end-users.
	 *
	 * @event module:digdug/Tunnel#status
	 * @type {string}
	 */

	/** The URL of a service that provides a list of environments supported by the tunnel. */
	environmentUrl: string;

	/**
	 * The tunnel access key. This will be initialized with a tunnel-specific environment variable if not specified.
	 */
	accessKey: string;

	/**
	 * The tunnel username. This will be initialized with a tunnel-specific environment variable if not specified.
	 */
	username: string;

	/**
	 * The architecture the tunnel will run against. This information is automatically retrieved for the current
	 * system at runtime.
	 */
	architecture: string;

	/**
	 * An HTTP authorization string to use when initiating connections to the tunnel. This value of this property is
	 * defined by Tunnel subclasses.
	 */
	auth: string;

	/**
	 * The directory where the tunnel software will be extracted. If the directory does not exist, it will be
	 * created. This value is set by the tunnel subclasses.
	 */
	directory: string;

	/** The executable to spawn in order to create a tunnel. This value is set by the tunnel subclasses. */
	executable: string;

	/**
	 * The host on which a WebDriver client can access the service provided by the tunnel. This may or may not be
	 * the host where the tunnel application is running.
	 */
	hostname: string;

	/** The path that a WebDriver client should use to access the service provided by the tunnel. */
	pathname: string;

	/**
	 * The operating system the tunnel will run on. This information is automatically retrieved for the current
	 * system at runtime.
	 */
	platform: string;

	/** The local port where the WebDriver server should be exposed by the tunnel. */
	port: string;

	/**
	 * The protocol (e.g., 'http') that a WebDriver client should use to access the service provided by the tunnel.
	 */
	protocol: string;

	/** The URL of a proxy server for the tunnel to go through. Only the hostname, port, and auth are used. */
	proxy: string;

	/** A unique identifier for the newly created tunnel. */
	tunnelId: string;

	/** The URL where the tunnel software can be downloaded. */
	url: string;

	/** Whether or not to tell the tunnel to provide verbose logging output. */
	verbose: boolean;

	protected _startTask: Task<any>;
	protected _stopTask: Promise<number>;
	protected _handle: Handle = null;
	protected _process: ChildProcess = null;
	protected _state: 'stopped' | 'starting' | 'running' | 'stopping' = 'stopped';

	/**
	 * The URL that a WebDriver client should used to interact with this service.
	 */
	get clientUrl(): string {
		return formatUrl(this);
	}

	/**
	 * A map of additional capabilities that need to be sent to the provider when a new session is being created.
	 */
	get extraCapabilities(): Object {
		return {};
	}

	/**
	 * Whether or not the tunnel software has already been downloaded.
	 */
	get isDownloaded(): boolean {
		return fileExists(this.executable);
	}

	/**
	 * Whether or not the tunnel is currently running.
	 */
	get isRunning(): boolean {
		return this._state === 'running';
	}

	/**
	 * Whether or not the tunnel is currently starting up.
	 */
	get isStarting(): boolean {
		return this._state === 'starting';
	}

	/**
	 * Whether or not the tunnel is currently stopping.
	 */
	get isStopping(): boolean {
		return this._state === 'stopping';
	}

	on(type: 'stderr' | 'stdout', listener: (event: IOEvent) => void): Handle;
	on(type: 'status', listener: (event: StatusEvent) => void): Handle;
	on(type: string, listener: (event: EventObject) => void): Handle;
	on(type: string, listener: (event: EventObject) => void): Handle {
		return super.on(type, listener);
	}

	/**
	 * Downloads and extracts the tunnel software if it is not already downloaded.
	 *
	 * This method can be extended by implementations to perform any necessary post-processing, such as setting
	 * appropriate file permissions on the downloaded executable.
	 *
	 * @param forceDownload Force downloading the software even if it already has been downloaded.
	 * @returns A promise that resolves once the download and extraction process has completed.
	 */
	download(forceDownload = false): Task<any> {
		if (!forceDownload && this.isDownloaded) {
			return Task.resolve();
		}
		return this._downloadFile(this.url, this.proxy);
	}

	protected _downloadFile(url: string, proxy: string, options?: DownloadOptions): Task<any> {
		let request: ResponsePromise<any>;

		if (!url) {
			return Task.reject(new Error('URL is empty'));
		}

		return new Task<any>(
			(resolve, reject) => {
				// TODO: progress events
				// function (info) {
				// 	self.emit('downloadprogress', util.mixin({}, info, { url: url }));
				// 	progress(info);
				// }
				request = sendRequest(url, <NodeRequestOptions<any>>{ proxy });
				request
					.then(response => {
						resolve(this._postDownloadFile(response, options));
					})
					.catch(error => {
						if (isRequestError(error) && error.response.statusCode >= 400) {
							error = new Error(`Download server returned status code ${error.response.statusCode}`);
						}
						reject(error);
					});
			},
			() => {
				request && request.cancel();
			}
		);
	}

	/**
	 * Called with the response after a file download has completed
	 */
	protected _postDownloadFile(response: Response<any>, options?: DownloadOptions): Promise<void>;
	protected _postDownloadFile(response: Response<any>): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			decompress(response.data, this.directory)
				.then(() => resolve())
				.catch(reject)
				;
		});
	}

	/**
	 * Creates the list of command-line arguments to be passed to the spawned tunnel. Implementations should
	 * override this method to provide the appropriate command-line arguments.
	 *
	 * Arguments passed to {@link module:digdug/Tunnel#_makeChild} will be passed as-is to this method.
	 *
	 * @returns A list of command-line arguments.
	 */
	protected _makeArgs(...values: string[]): string[] {
		return [];
	}

	/**
	 * Creates a newly spawned child process for the tunnel software. Implementations should call this method to
	 * create the tunnel process.
	 *
	 * Arguments passed to this method will be passed as-is to {@link module:digdug/Tunnel#_makeArgs} and
	 * {@link module:digdug/Tunnel#_makeOptions}.
	 *
	 * @returns An object containing a newly spawned Process and a Deferred that will be resolved once the tunnel has started
	 * successfully.
	 */
	protected _makeChild(executor: ChildExecutor, ...values: string[]): Task<any> {
		const command = this.executable;
		const args = this._makeArgs(...values);
		const options = this._makeOptions(...values);
		const child = spawn(command, args, options);

		child.stdout.setEncoding('utf8');
		child.stderr.setEncoding('utf8');

		let handle: Handle;
		let canceled = false;
		const task = new Task(
			(resolve, reject) => {
				let errorMessage = '';
				let exitCode: number = null;
				let stderrClosed = false;

				function handleChildExit() {
					if (task.state === State.Pending) {
						reject(new Error(`Tunnel failed to start: ${errorMessage || `Exit code: ${exitCode}`}`));
					}
				}
				handle = createCompositeHandle(
					on(child, 'error', reject),
					on(child.stderr, 'data', (data: string) => {
						errorMessage += data;
					}),
					on(child, 'exit', (code: number) => {
						exitCode = code;
						if (stderrClosed) {
							handleChildExit();
						}
					}),
					// stderr might still have data in buffer at the time the exit event is sent, so we have to store data
					// from stderr and the exit code and reject only once stderr closes
					on(child.stderr, 'close', () => {
						stderrClosed = true;
						if (exitCode !== null) {
							handleChildExit();
						}
					})
				);

				const result = executor(child, resolve, reject);
				if (result) {
					handle = createCompositeHandle(handle, result);
				}
			},
			() => {
				canceled = true;
				child.kill('SIGINT');
			}
		);

		return task
			.finally(() => {
				handle.destroy();
				if (canceled) {
					// We only want this to run when cancelation has occurred
					return new Promise(resolve => {
						child.once('exit', () => {
							resolve();
						});
					});
				}
			});
	}

	/**
	 * Creates the set of options to use when spawning the tunnel process. Implementations should override this
	 * method to provide the appropriate options for the tunnel software.
	 *
	 * Arguments passed to {@link module:digdug/Tunnel#_makeChild} will be passed as-is to this method.
	 *
	 * @returns A set of options matching those provided to Node.js {@link module:child_process.spawn}.
	 */
	protected _makeOptions(...values: string[]) {
		return { env: process.env };
	}

	/**
	 * Sends information about a job to the tunnel provider.
	 *
	 * @param jobId The job to send data about. This is usually a session ID.
	 * @param data Data to send to the tunnel provider about the job.
	 * @returns A promise that resolves once the job state request is complete.
	 */
	sendJobState(jobId: string, data: JobState): Task<void> {
		return Task.reject<void>(new Error('Job state is not supported by this tunnel.'));
	}

	/**
	 * Starts the tunnel, automatically downloading dependencies if necessary.
	 *
	 * @returns A promise that resolves once the tunnel has been established.
	 */
	start() {
		switch (this._state) {
			case 'stopping':
				throw new Error('Previous tunnel is still terminating');
			case 'running':
			case 'starting':
				return this._startTask;
		}

		this._state = 'starting';

		this._startTask = this
			.download()
			.then(() => {
				return this._start((child, resolve, reject) => {
					this._process = child;
					this._handle = createCompositeHandle(
						this._handle || { destroy: function () { } },
						on(child.stdout, 'data', proxyIOEvent(this, 'stdout')),
						on(child.stderr, 'data', proxyIOEvent(this, 'stderr')),
						on(child, 'exit', () => {
							this._state = 'stopped';
						})
					);
				});
			});

		this._startTask
			.then(() => {
				this._startTask = null;
				this._state = 'running';
				this.emit<StatusEvent>({
					type: 'status',
					target: this,
					status: 'Ready'
				});
			})
			.catch(error => {
				this._startTask = null;
				this._state = 'stopped';
				this.emit<StatusEvent>({
					type: 'status',
					target: this,
					status: error.name === 'CancelError' ? 'Start cancelled' : 'Failed to start tunnel'
				});
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
	 * @returns An object containing a reference to the child process, and a Deferred that is resolved once the tunnel is
	 * ready for use. Normally this will be the object returned from a call to `Tunnel#_makeChild`.
	 */
	protected _start(executor: ChildExecutor) {
		return this._makeChild((child, resolve, reject) => {
			const handle = createCompositeHandle(
				on(child.stdout, 'data', resolve),
				on(child.stderr, 'data', resolve),
				on(child, 'error', (error: Error) => {
					reject(error);
				})
			);

			executor(child, resolve, reject);

			return handle;
		});
	}

	/**
	 * Stops the tunnel.
	 *
	 * @returns A promise that resolves to the exit code for the tunnel once it has been terminated.
	 */
	stop(): Promise<number> {
		switch (this._state) {
			case 'starting':
				this._startTask.cancel();
				return this._startTask.finally(() => null);
			case 'stopping':
				return this._stopTask;
		}

		this._state = 'stopping';

		this._stopTask = this._stop()
			.then(returnValue => {
				this._handle.destroy();
				this._process = this._handle = null;
				this._state = 'stopped';
				return returnValue;
			})
			.catch(error => {
				this._state = 'running';
				throw error;
			})
			;

		return this._stopTask;
	}

	/**
	 * This method provides the implementation that actually stops the tunnel.
	 *
	 * The default implementation that assumes the tunnel has been closed once the child process has exited. This
	 * method should be reimplemented by other tunnel launchers to implement correct shutdown logic, if necessary.
	 *
	 * @returns A promise that resolves once the tunnel has shut down.
	 */
	protected _stop(): Promise<number> {
		return new Promise(resolve => {
			const childProcess = this._process;

			childProcess.once('exit', code => {
				resolve(code);
			});

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
	getEnvironments(): Task<NormalizedEnvironment[]> {
		if (!this.environmentUrl) {
			return Task.resolve([]);
		}

		return <Task<any>>sendRequest(this.environmentUrl, <NodeRequestOptions<any>>{
			password: this.accessKey,
			user: this.username,
			proxy: this.proxy
		}).then(response => {
			if (response.statusCode >= 200 && response.statusCode < 400) {
				return JSON.parse(response.data.toString())
					.reduce((environments: NormalizedEnvironment[], environment: any) => {
						return environments.concat(this._normalizeEnvironment(environment));
					}, [])
					;
			}
			else {
				throw new Error(`Server replied with a status of ${response.statusCode}`);
			}
		});
	}

	/**
	 * Normalizes a specific Tunnel environment descriptor to a general form. To be overriden by a child implementation.
	 *
	 * @param environment an environment descriptor specific to the Tunnel
	 * @returns a normalized environment
	 */
	protected _normalizeEnvironment(environment: Object): NormalizedEnvironment {
		return <any>environment;
	}
}

// tslint:disable-next-line:interface-name
export interface IOEvent extends EventTargettedObject<Tunnel> {
	readonly type: 'stdout' | 'stderr';
	readonly data: string;
}

export interface StatusEvent extends EventTargettedObject<Tunnel> {
	readonly type: 'status';
	readonly status: string;
}

export interface ChildExecutor {
	(child: ChildProcess, resolve: () => void, reject: (reason?: any) => void): Handle | void;
}

export interface DownloadOptions {
	directory: string;
	proxy: string;
	url: string;
}

export interface NormalizedEnvironment {
	browserName: string;
	browserVersion?: string;
	descriptor: Object;
	platform: string;
	platformName?: string;
	platformVersion?: string;
	version: string;

	intern: {
		platform: string;
		browserName: string;
		version: string;
	};
}

export interface TunnelProperties extends DownloadOptions {
	architecture: string;
	auth: string;
	executable: string;
	hostname: string;
	pathname: string;
	platform: string;
	port: string;
	protocol: string;
	tunnelId: string;
	verbose: boolean;
}

export type TunnelOptions = Partial<TunnelProperties>;

function proxyIOEvent(target: Tunnel, type: 'stdout' | 'stderr') {
	return function (data: any) {
		target.emit<IOEvent>({
			type,
			target,
			data: String(data)
		});
	};
}

delete Tunnel.prototype.on;
