/**
 * @module digdug/NullTunnel
 */

import Tunnel from './Tunnel';
import DojoPromise = require('dojo/Promise');
import { mixin } from './util';

/**
 * A no-op tunnel.
 *
 * @constructor module:digdug/NullTunnel
 * @extends module:digdug/Tunnel
 */
class NullTunnel extends Tunnel {
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

export = NullTunnel;
