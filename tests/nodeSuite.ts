// This a bridge moduel that loads CommonJS test suites written using Intern's object interface.
// It must be loaded by an AMD loader. CommonJS suite IDs are relative to this module.
//
// A CommonJS suite loaded by this module should export its suite definition as
// the default export.

import { IRequire } from 'dojo/loader';
import registerSuite = require('intern!object');

declare const require: IRequire;

export function load(id: string, pluginRequire: IRequire, callback: Function) {
	if (typeof process !== 'undefined') {
		pluginRequire([ 'dojo/node!' + require.toUrl('./' + id) ], function (module) {
			const suites = [].concat(module.default);
			suites.forEach(function (suite) {
				registerSuite(suite);
			});
			callback(module);
		});
	}
	else {
		callback();
	}
};
