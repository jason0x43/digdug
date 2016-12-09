import { echo } from 'shelljs';
import { exec } from './common';

echo('### Preparing dist');

exec('npm run clean');
exec('npm run lint');
exec('npm run build');
exec('npm run test');

echo('### Done preparing dist');
