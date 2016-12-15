export const proxyPort = 9000;

export const proxyUrl = 'http://localhost:9000';

export const maxConcurrency = 3;

export const loaderOptions = {
	packages: [
		{ name: 'src', location: '_build/src' },
		{ name: 'tests', location: './_build/tests' }
	],
	map: {
		'tests': {
			// map the absolute module `src` so that it uses
			// the srcLoader to get a relative commonjs library
			'src': 'tests/srcLoader!../src',
			// ensure the `dojo` being used in the tests is the
			// same `dojo` being used by the commonjs library
			// with the exception of `dojo/node`
			'dojo': 'dojo/node!dojo',
			'dojo/node': 'dojo/node'
		},
		'tests/srcLoader': {
			'src': 'src'
		}
	}
};

export const loaders = {
	'host-node': 'dojo-loader'
};

export const reporters = [ 'Console' ];

export const suites = [
	'tests/unit/BrowserStackTunnel',
	'tests/unit/SauceLabsTunnel',
	'tests/unit/TestingBotTunnel',
	'tests/unit/Tunnel',
	'tests/unit/util',

	'tests/integration/BrowserStackTunnel',
	'tests/integration/NullTunnel',
	'tests/integration/SauceLabsTunnel',
	'tests/integration/SeleniumTunnel',
	'tests/integration/TestingBotTunnel'
];

export const excludeInstrumentation = /^(?:_build\/tests|node_modules)\//;
