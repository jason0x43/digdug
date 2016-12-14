import { assert } from 'chai';
import Tunnel from '../../src/Tunnel';
import DojoPromise = require('dojo/Promise');
import Test = require('intern/lib/Test');

let tunnel: Tunnel;

const suite = {
	beforeEach: function () {
		tunnel = new Tunnel({ foo: 'bar' });
	},

	'#clientUrl'() {
		tunnel.port = '4446';
		tunnel.hostname = 'foo.com';
		tunnel.protocol = 'https';
		tunnel.pathname = 'bar/baz/';
		assert.strictEqual(tunnel.clientUrl, 'https://foo.com:4446/bar/baz/');
	},

	'#extraCapabilities'() {
		assert.deepEqual(tunnel.extraCapabilities, {});
	},

	'#start': {
		'start a running tunnel; throws'() {
			tunnel.isRunning = true;
			assert.throws(function () {
				tunnel.start();
			});
		},

		'start a stopping tunnel; throws'() {
			tunnel.isStopping = true;
			assert.throws(function () {
				tunnel.start();
			});
		}
	},

	'#stop': {
		'stop a stopping tunnel'() {
			tunnel['_state'] = 'stopping';
			return tunnel.stop();
		},

		'stop a starting tunnnel'() {
			const startTask = new DojoPromise<any>(function (resolve) {
				setTimeout(resolve);
			});
			tunnel['_state'] = 'starting';
			tunnel['_startTask'] = startTask;
			tunnel['_stop'] = () => Promise.resolve(0);
			return tunnel.stop();
		},

		'stop a tunnel that is not running; throws'() {
			tunnel['_state'] = 'stopped';
			tunnel['_stop'] = () => Promise.resolve(0);
			tunnel['_handles'] = [];
			return tunnel.stop();
		}
	},

	'#sendJobState'(this: Test) {
		const dfd = this.async();
		tunnel.sendJobState('jobId', null).then(
			() => dfd.reject(new Error('expected exception')),
			() => dfd.resolve()
		);
	}
};

export default suite;
