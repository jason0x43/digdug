import * as assert from 'intern/chai!assert';
import TestingBotTunnel from 'src/TestingBotTunnel';
import registerSuite = require('intern!object');

let tunnel: TestingBotTunnel;

registerSuite({
	beforeEach() {
		tunnel = new TestingBotTunnel();
	},

	afterEach() {
		tunnel = null;
	},

	'#auth'() {
		tunnel.apiKey = 'foo';
		tunnel.apiSecret = 'bar';
		assert.equal(tunnel.auth, 'foo:bar');
	}
});
