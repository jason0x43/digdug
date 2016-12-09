import { cp, echo, rm, test } from 'shelljs';
import { join } from 'path';
import { buildDir, exec } from './common';

echo('### Building');

if (test('-d', buildDir)) {
	echo('### Removing existing build directory');
	rm('-r', buildDir);
}

echo('### Building source');
exec('node ./node_modules/.bin/tsc');

echo('### Building tests');
exec('node ./node_modules/.bin/tsc --project tests/tsconfig.json');

echo('### Copying resources');
cp([
	'./src/interfaces.d.ts',
	'./package.json',
	'./LICENSE'
], join(buildDir, 'src'));

echo('### Done building');
