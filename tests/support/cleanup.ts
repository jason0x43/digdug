import args from './args';
import { existsSync, readdirSync, lstatSync, unlinkSync, rmdirSync } from 'fs';
import { join as joinPath } from 'path';
import Tunnel from 'src/Tunnel';
/**
 * Deletes the directory used by the tunnel
 * @param tunnel
 */
export function deleteTunnelFiles(tunnel: Tunnel) {
	if (!tunnel || args.noClean) {
		return;
	}

	function deleteRecursive(dir: string): void {
		if (existsSync(dir)) {
			const files = readdirSync(dir);
			files.forEach(function (file) {
				const path = joinPath(dir, file);
				try {
					if (lstatSync(path).isDirectory()) {
						deleteRecursive(path);
					}
					else {
						unlinkSync(path);
					}
				}
				catch (error) {
					if ((<any> error).code !== 'ENOENT') {
						console.warn('Unable to delete ' + path, error);
					}
				}
			});
			rmdirSync(dir);
		}
	}

	deleteRecursive(tunnel.directory);
}

/**
 * Cleans up a tunnel by stopping it if the tunnel is running and deleting its target install directory
 *
 * @param tunnel
 * @return {Promise} a promise resolved when cleanup is complete
 */
export function cleanup(tunnel: Tunnel) {
	if (!tunnel) {
		return;
	}

	if (tunnel.isRunning) {
		const deleteFiles = function () {
			deleteTunnelFiles(tunnel);
		};

		return tunnel.stop().then(deleteFiles, deleteFiles);
	}
	else {
		deleteTunnelFiles(tunnel);
		return Promise.resolve<void>();
	}
}
