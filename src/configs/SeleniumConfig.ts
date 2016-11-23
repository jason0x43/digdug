import { mixin } from '../util';
import { format } from 'util';
import { RemoteFile } from '../SeleniumTunnel';

/**
 * Artifact configuration information for the Selenium standalone jar
 * @param config {String|Object} a selenium version number or mixin properties
 * @constructor
 */
export default class SeleniumConfig implements RemoteFile {
	constructor(config: string | Object) {
		if (typeof config === 'string') {
			this.version = config;
		}
		else {
			mixin(this, config);
		}
	}

	version: string = '2.53.0';

	baseUrl: string = 'https://selenium-release.storage.googleapis.com';

	dontExtract: boolean = true;

	get artifact() {
		return `selenium-server-standalone-${ this.version }.jar`;
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
		return `selenium-server-${ this.version }-server.jar`;
	}
}
