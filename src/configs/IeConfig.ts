import { mixin } from '../util';
import { format } from 'util';
import { DriverFile } from '../SeleniumTunnel';
import { KwArgs } from '../interfaces';

/**
 * Artifact configuration information for Internet Explorer driver
 * @param config {Object} mixin properties
 */
export default class IeConfig implements DriverFile {
	constructor(config: KwArgs) {
		mixin(this, config);
	}

	version: string = '2.53.0';

	baseUrl: string = 'https://selenium-release.storage.googleapis.com';

	arch: string = process.arch;

	get artifact() {
		const architecture = this.arch === 'x64' ? 'x64' : 'Win32';

		return format(
			'IEDriverServer_%s_%s.zip',
			architecture,
			this.version
		);
	}

	get url() {
		const majorMinorVersion = this.version.slice(0, this.version.lastIndexOf('.'));

		return format(
			'%s/%s/%s',
			this.baseUrl,
			majorMinorVersion,
			this.artifact
		);
	}

	get executable() {
		return 'IEDriverServer.exe';
	}

	get seleniumProperty() {
		return 'webdriver.ie.driver';
	}
}
