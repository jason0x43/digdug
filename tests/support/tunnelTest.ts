import { args } from 'intern';
import { cleanup } from './cleanup';
import { Deferred } from 'dojo/Promise';
import Tunnel from 'src/Tunnel';

function nocheck() {
	return false;
}

export default function tunnelTest(dfd: Deferred<void>, tunnel: Tunnel, check: (error: Error) => boolean = nocheck) {
	cleanup(tunnel);

	if (args.showStdout) {
		tunnel.on('stdout', console.log);
		tunnel.on('stderr', console.log);
	}

	tunnel.start().then(function () {
		dfd.resolve();
	}).catch(function (error) {
		if (check(error)) {
			dfd.resolve();
		}
		else {
			dfd.reject(error);
		}
	});
};
