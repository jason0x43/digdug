import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import createCommonTests from './common';
import BrowserStackTunnel from 'src/BrowserStackTunnel';
import Tunnel, { NormalizedEnvironment} from 'src/Tunnel';
import tunnelTest from '../support/tunnelTest';
import Test = require('intern/lib/Test');

registerSuite({
	name: 'integration/BrowserStackTunnel',

	'common tests': createCommonTests({
		tunnelClass: BrowserStackTunnel,

		assertDescriptor(environment: NormalizedEnvironment) {
			assert.property(environment, 'os_version');
			assert.property(environment, 'browser');
			assert.property(environment, 'os');
			assert.property(environment, 'device');
			assert.property(environment, 'browser_version');
		},

		requirementsCheck(tunnel: Tunnel) {
			return !!tunnel.accessKey && !!tunnel.username;
		},

		missingRequirementsMessage: 'missing credentials. Please provide BrowserStack credentials with the ' +
		'BROWSERSTACK_ACCESS_KEY and BROWSERSTACK_USERNAME environment variables'
	}),

	'#start'(this: Test) {
		if (!BrowserStackTunnel.prototype.accessKey || !BrowserStackTunnel.prototype.username) {
			this.skip('auth data not present');
		}

		const tunnel = new BrowserStackTunnel();

		tunnelTest(this.async(), tunnel, function (error) {
			return /The tunnel reported:/.test(error.message);
		});
	}
});
