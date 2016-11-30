var shelljs = require('shelljs');

exports.exec = function (command) {
	return new Promise(function (resolve, reject) {
		shelljs.exec(command, { async: true }, resolve);
	});
};
