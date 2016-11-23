import { mixin } from '../util';
import { format } from 'util';
import { DriverFile } from '../SeleniumTunnel';
import { KwArgs } from '../interfaces';

/**
 * Artifact configuration information for the Chrome driver
 * @param config {Object} mixin properties
 */
export default class ChromeConfig implements DriverFile {
	constructor(config: KwArgs) {
		mixin(this, config);
	}

	version: string = '2.22';

	baseUrl: string = 'https://chromedriver.storage.googleapis.com';

	platform: string = process.platform;

	arch: string = process.arch;

	get artifact() {
		let platform = 'win32';

		if (this.platform === 'linux') {
			const arch = (this.arch === 'x64' ? '64' : '32')
			platform = `linux${ arch }`;
		}
		else if (this.platform === 'darwin') {
			platform = 'mac32';
		}

		return `chromedriver_${ platform }.zip`;
	}

	get url() {
		return format(
			'%s/%s/%s',
			this.baseUrl,
			this.version,
			this.artifact
		);
	}

	get executable() {
		return this.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
	}

	get seleniumProperty() {
		return 'webdriver.chrome.driver';
	}
}
