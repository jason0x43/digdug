import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import TestingBotTunnel from 'src/TestingBotTunnel';
import createCommonTests from './common';
import tunnelTest from '../support/tunnelTest';
import Test = require('intern/lib/Test');

registerSuite({
	name: 'integration/TestingBotTunnel',

	'common tests': createCommonTests({
		tunnelClass: TestingBotTunnel,

		assertDescriptor: function (environment) {
			assert.property(environment, 'selenium_name');
			assert.property(environment, 'name');
			assert.property(environment, 'platform');
			assert.property(environment, 'version');
		}
	}),

	'#start'(this: Test) {  // TODO move this to integration tests
		if (!TestingBotTunnel.prototype.apiKey || !TestingBotTunnel.prototype.apiSecret) {
			this.skip('auth data not present');
		}

		const tunnel = new TestingBotTunnel();

		tunnelTest(this.async(120000), tunnel, function (error) {
			return /Could not get tunnel info/.test(error.message);
		});
	}
});
