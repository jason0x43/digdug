export const proxyPort = 9000;

export const proxyUrl = 'http://localhost:9000';

export const maxConcurrency = 3;

export const loaderOptions = {
	packages: [
		{ name: 'src', location: './dist/src' },
		{ name: 'tests', location: './dist/tests' },
		{ name: 'sinon', location: './node_modules/sinon/pkg', main: 'sinon' }
	]
};

export const loaders = {
	'host-browser': 'node_modules/dojo-loader/loader.js',
	'host-node': 'dojo-loader'
};

export const reporters = [ 'Console' ];

export const suites = [
	'dojo/has!host-node?tests/unit/all',
	'dojo/has!host-node?tests/integration/all'
];

export const functionalSuites: string[] = [];
export const excludeInstrumentation = /^(?:tests|node_modules)\//;
