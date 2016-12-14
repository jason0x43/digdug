import tunnelTest from '../support/tunnelTest';
import NullTunnel from '../../src/NullTunnel';
import Test = require('intern/lib/Test');

const suite = {
	'#start'(this: Test) {
		const tunnel = new NullTunnel();

		tunnelTest(this.async(), tunnel, function (error) {
			return /Could not get tunnel info/.test(error.message);
		});
	}
};

export default suite;
