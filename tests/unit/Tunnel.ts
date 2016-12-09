import * as assert from 'intern/chai!assert';
import Tunnel from 'src/Tunnel';
import Test = require('intern/lib/Test');
import registerSuite = require('intern!object');

let tunnel: Tunnel;

registerSuite({
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
		'stop a stopping tunnel; throws'() {
			tunnel.isStopping = true;
			assert.throws(function () {
				tunnel.stop();
			});
		},

		'stop a starting tunnnel; throws'() {
			tunnel.isStarting = true;
			assert.throws(function () {
				tunnel.stop();
			});
		},

		'stop a tunnel that is not running; throws'() {
			tunnel.isRunning = false;
			assert.throws(function () {
				tunnel.stop();
			});
		}
	},

	'#sendJobState'(this: Test) {
		const dfd = this.async();
		tunnel.sendJobState('jobId', null).then(() => dfd.reject(new Error('expected exception')), dfd.resolve);
	}
});
