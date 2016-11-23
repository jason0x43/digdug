import { mixin } from '../util';
import { format } from 'util';
import { DriverFile } from '../SeleniumTunnel';
import { KwArgs } from '../interfaces';

/**
 * Artifact configuration information for the Firefox driver
 * @param config {Object} mixin properties
 * @constructor
 */
export default class FirefoxConfig implements DriverFile {
	constructor(config: KwArgs) {
		mixin(this, config);
	}

	version: string = '0.9.0';

	baseUrl: string = 'https://github.com/mozilla/geckodriver/releases/download';

	platform: string = process.platform;

	get artifact() {
		const platform = (this.platform === 'linux' ? 'linux64'
			: this.platform === 'darwin' ? 'mac' : 'win64');
		const type = (this.platform === 'win32' ? '.zip' : '.tar.gz');

		return format(
			'geckodriver-v%s-%s%s',
			this.version,
			platform,
			type
		);
	}

	get url() {
		return format(
			'%s/v%s/%s',
			this.baseUrl,
			this.version,
			this.artifact
		);
	}

	get executable() {
		return this.platform === 'win32' ? 'geckodriver.exe' : 'geckodriver';
	}

	get seleniumProperty() {
		return 'webdriver.gecko.driver';
	}
}
