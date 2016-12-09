import { args } from 'intern';
import { Deferred } from 'dojo/Promise';
import Tunnel from 'src/Tunnel';

function nocheck() {
	return false;
}

export default function tunnelTest(dfd: Deferred<void>, tunnel: Tunnel, check: (error: Error) => boolean = nocheck): Promise<void> {
	if (args.showStdout) {
		tunnel.on('stdout', console.log);
		tunnel.on('stderr', console.log);
	}

	let failure: Error;

	return tunnel.start().catch(function (error) {
		if (!check(error)) {
			failure = error;
		}
	}).then(function () {
		return tunnel.stop();
	}).catch(function (error) {
		if (!failure) {
			failure = error;
		}
	}).then(function () {
		if (failure) {
			dfd.reject(failure);
		}
		else {
			dfd.resolve();
		}
	});
};
