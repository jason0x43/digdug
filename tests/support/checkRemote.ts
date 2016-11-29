import { parse as parseUrl } from 'url';
import { request, RequestOptions } from 'https';
import { ClientResponse } from 'http';

/**
 * Uses a HEAD request to check for the existence of the URL endpoint
 *
 * @param {string} url the target URL
 */
export default function (url: string): Promise<any> {
	return new Promise(function (resolve, reject) {
		const options: RequestOptions = <any> parseUrl(url);
		options.method = 'HEAD';
		// using https module due to an issue w/ 302'd https head requests w/ dojo/request
		// https://github.com/ansible/ansible-modules-core/issues/3457
		request(options, function (response: ClientResponse) {
			if (response.statusCode >= 400) {
				reject(new Error('Status code ' + response.statusCode + ' returned for ' + url));
			}
			else {
				resolve(response);
			}
		}).end();
	});
};
