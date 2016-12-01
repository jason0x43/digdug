import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import createCommonTests from './common';
import SauceLabsTunnel from 'src/SauceLabsTunnel';
import tunnelTest from '../support/tunnelTest';
import Test = require('intern/lib/Test');

registerSuite({
	name: 'integration/SauceLabsTunnel',

	'common tests': createCommonTests({
		tunnelClass: SauceLabsTunnel,

		assertDescriptor: function (environment) {
			assert.property(environment, 'short_version');
			assert.property(environment, 'api_name');
			assert.property(environment, 'os');
		}
	}),

	'#start'(this: Test) {
		if (!SauceLabsTunnel.prototype.accessKey || !SauceLabsTunnel.prototype.username) {
			this.skip('auth data not present');
		}

		const tunnel = new SauceLabsTunnel();

		tunnelTest(this.async(120000), tunnel, function (error) {
			return /Not authorized/.test(error.message);
		});
	}
});