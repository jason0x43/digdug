import { echo } from 'shelljs';
import { join } from 'path';
import { buildDir, exec } from './common';

echo('### Testing');

const args = process.argv.slice(2);

if (!args.some(arg => arg.indexOf('config=') === 0)) {
	args.push(`config=${join(buildDir, 'tests', 'intern')}`);
}

exec(`./node_modules/.bin/intern-client ${args.join(' ')}`);

echo('### Done testing');
