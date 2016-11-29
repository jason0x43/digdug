import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import createCommonTests from './common';
import SauceLabsTunnel from 'src/SauceLabsTunnel';

registerSuite(createCommonTests({
	name: 'integration/SauceLabsTunnel',

	tunnelClass: SauceLabsTunnel,

	assertDescriptor: function (environment) {
		assert.property(environment, 'short_version');
		assert.property(environment, 'api_name');
		assert.property(environment, 'os');
	}
}));
