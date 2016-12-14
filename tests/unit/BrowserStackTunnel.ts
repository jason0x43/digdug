import { assert } from 'chai';
import BrowserStackTunnel from '../../src/BrowserStackTunnel';
import { cleanup } from '../support/cleanup';

let tunnel: BrowserStackTunnel;

const suite = {
	beforeEach: function () {
		tunnel = new BrowserStackTunnel();
	},

	afterEach: function () {
		const promise = cleanup(tunnel);
		tunnel = null;
		return promise;
	},

	'#auth'() {
		tunnel.username = 'foo';
		tunnel.accessKey = 'bar';
		assert.equal(tunnel.auth, 'foo:bar');
	},

	'#executable': {
		'unknown platform'() {
			tunnel.platform = 'foo';
			const executable = './BrowserStackLocal';
			assert.equal(tunnel.executable, executable);
		},

		windows() {
			tunnel.platform = 'win32';
			const executable = './BrowserStackLocal.exe';
			assert.equal(tunnel.executable, executable);
		}
	},

	'#extraCapabilities'() {
		const capabilities: { [ key: string ]: string } = { 'browserstack.local': 'true' };
		assert.deepEqual(tunnel.extraCapabilities, capabilities);

		capabilities['browserstack.localIdentifier'] = tunnel.tunnelId = 'foo';
		assert.deepEqual(tunnel.extraCapabilities, capabilities);
	},

	'#url': (() => {
		const url = 'https://www.browserstack.com/browserstack-local/BrowserStackLocal-';

		return {
			'unknown platform'() {
				tunnel.platform = 'foo';
				assert.throws(function () {
					tunnel.url;
				});
			},

			mac() {
				tunnel.platform = 'darwin';
				tunnel.architecture = 'x64';
				assert.equal(tunnel.url, url + 'darwin-x64.zip');
			},

			windows() {
				tunnel.platform = 'win32';
				tunnel.architecture = 'x64';
				assert.equal(tunnel.url, url + 'win32.zip');
			},

			'64-bit linux'() {
				tunnel.platform = 'linux';
				tunnel.architecture = 'x64';
				assert.equal(tunnel.url, url + 'linux-x64.zip');
			},

			'32-bit linux'() {
				tunnel.platform = 'linux';
				tunnel.architecture = 'ia32';
				assert.equal(tunnel.url, url + 'linux-ia32.zip');
			}
		};
	})()
};

export default suite;
