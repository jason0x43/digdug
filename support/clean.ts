import { echo, rm } from 'shelljs';
import { buildDir } from './common';

echo('### Cleaning');

rm('-rf', [
	buildDir,
	'browserstack',
	'saucelabs',
	'selenium-standalone',
	'testingbot'
]);

echo('### Done cleaning');
