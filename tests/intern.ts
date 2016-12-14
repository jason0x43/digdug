export const proxyPort = 9000;

export const proxyUrl = 'http://localhost:9000';

export const maxConcurrency = 3;

export const loaderOptions = {
	packages: [
		{ name: 'tests', location: './_build/tests' },
		{ name: 'sinon', location: './node_modules/sinon/pkg', main: 'sinon' }
	]
};

export const loaders = {
	'host-node': 'dojo-loader'
};

export const reporters = [ 'Console' ];

export const suites = [
	'tests/nodeSuite!unit/BrowserStackTunnel',
	'tests/nodeSuite!unit/SauceLabsTunnel',
	'tests/nodeSuite!unit/TestingBotTunnel',
	'tests/nodeSuite!unit/Tunnel',
	'tests/nodeSuite!unit/util',

	'tests/nodeSuite!integration/BrowserStackTunnel',
	'tests/nodeSuite!integration/NullTunnel',
	'tests/nodeSuite!integration/SauceLabsTunnel',
	'tests/nodeSuite!integration/SeleniumTunnel',
	'tests/nodeSuite!integration/TestingBotTunnel'
];

export const excludeInstrumentation = /^(?:_build\/tests|node_modules)\//;
