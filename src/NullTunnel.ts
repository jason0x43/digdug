/**
 * @module digdug/NullTunnel
 */

import Tunnel from './Tunnel';
import { mixin } from './util';
import DojoPromise = require('dojo/Promise');

/**
 * A no-op tunnel.
 *
 * @constructor module:digdug/NullTunnel
 * @extends module:digdug/Tunnel
 */
export default class NullTunnel extends Tunnel {
	download() {
		return DojoPromise.resolve(null);
	}

	start() {
		this.isRunning = false;
		return DojoPromise.resolve(null);
	}

	stop() {
		this.isRunning = false;
		return Promise.resolve();
	}

	sendJobState() {
		return Promise.resolve<void>();
	}
}

/**
 * Default values placed on the prototype
 */
mixin(NullTunnel.prototype, {
	auth: '',
	isDownloaded: true
});
