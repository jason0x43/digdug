import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import TestingBotTunnel from 'src/TestingBotTunnel';
import createCommonTests from './common';

registerSuite(createCommonTests({
	name: 'integration/TestingBotTunnel',

	tunnelClass: TestingBotTunnel,

	assertDescriptor: function (environment) {
		assert.property(environment, 'selenium_name');
		assert.property(environment, 'name');
		assert.property(environment, 'platform');
		assert.property(environment, 'version');
	}
}));
