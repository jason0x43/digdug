import { echo } from 'shelljs';
import { exec } from './common';

echo('### Linting');
echo('### Linting code');
exec('./node_modules/.bin/tslint --project tsconfig.json');
echo('### Linting tests');
exec('./node_modules/.bin/tslint --project tests/tsconfig.json');
echo('### Done linting');
