import { IResponse } from 'dojo/request';
import request = require('dojo/request');

/**
 * Checks to see if Selenium is already running
 *
 * @param port the port selenium is running on
 * @param hostname the hostname selenium is running on
 */
export default function (port = '4444', hostname = 'localhost'): Promise<void> {
	return request('http://' + hostname + ':' + port + '/wd/hub/status', {})
		.then(function (response: IResponse) {
			if (response.statusCode !== 200) {
				throw new Error('Server reported ' + response.statusCode + ' with: ' + response.data);
			}

			const json = JSON.parse(response.data.toString());

			if ( json.state !== 'success' ) {
				throw new Error('Selenium Tunnel reported a state of ' + json.state );
			}
		});
};
