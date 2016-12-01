var shelljs = require('shelljs');

exports.exec = function (command) {
	return new Promise(function (resolve, reject) {
		shelljs.exec(command, { async: true }, function (code) {
			if (code !== 0) {
				process.exitCode = code;
				reject(new Error('Command failed: "' + command + '" exit code: ' + code));
			}
			else {
				resolve();
			}
		});
	});
};

exports.exitGracefully = function (error) {
	error && console.log(error.message);
	if (process.exitCode === 0) {
		process.exitCode = 1;
	}
};
