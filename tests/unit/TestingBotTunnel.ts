import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import TestingBotTunnel from 'src/TestingBotTunnel';

let tunnel: TestingBotTunnel;

registerSuite({
	beforeEach: function () {
		tunnel = new TestingBotTunnel();
	},

	'#auth'() {
		tunnel.apiKey = 'foo';
		tunnel.apiSecret = 'bar';
		assert.equal(tunnel.auth, 'foo:bar');
	}
});
