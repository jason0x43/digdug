import * as assert from 'intern/chai!assert';
import Tunnel, { NormalizedEnvironment } from 'src/Tunnel';
import { inspect } from 'util';
import Test = require('intern/lib/Test');

export interface Descriptor {
	assertDescriptor(descriptor: Object): void;
	missingRequirementsMessage?: string;
	name?: string;
	requirementsCheck?(tunnel: Tunnel): boolean;
	tunnelClass: typeof Tunnel;
}

export default function (descriptor: Descriptor): any {
	let metRequirements = false;
	const _TunnelConstructor: typeof Tunnel = descriptor.tunnelClass;

	function assertNormalizedProperties(environment: NormalizedEnvironment) {
		const message = ' undefined for ' + inspect(environment.descriptor);
		assert.isDefined(environment.browserName, `browserName${ message }`);
		assert.isDefined(environment.version, `version${ message}`);
		assert.isDefined(environment.platform, `platform${ message }`);
	}

	const suite: any = {
		beforeEach() {
			suite.tunnel = new _TunnelConstructor();
			metRequirements = !descriptor.requirementsCheck || descriptor.requirementsCheck(suite.tunnel);
		},

		getEnvironments(this: Test) {
			if (!metRequirements) {
				this.skip(descriptor.missingRequirementsMessage);
			}

			return suite.tunnel.getEnvironments().then(function (environments: NormalizedEnvironment[]) {
				assert.isArray(environments);
				assert.isAbove(environments.length, 0, 'Expected at least 1 environment');
				environments.forEach(function (environment) {
					assertNormalizedProperties(environment);
					assert.property(environment, 'descriptor');
					descriptor.assertDescriptor(environment.descriptor);
				});
			});
		}
	};

	if (descriptor.name) {
		suite.name = descriptor.name;
	}

	return suite;
}
