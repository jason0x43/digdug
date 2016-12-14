import { assert } from 'chai';
import TestingBotTunnel from '../../src/TestingBotTunnel';

let tunnel: TestingBotTunnel;

const suite = {
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
};

export default suite;
