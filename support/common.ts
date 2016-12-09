import { readFileSync } from 'fs';
import { exec as shellExec } from 'shelljs';

const tsconfig = JSON.parse(readFileSync('tsconfig.json', { encoding: 'utf8' }));
const buildDir = tsconfig.compilerOptions.outDir;
export { tsconfig, buildDir };

export function exec(command: string) {
	const result = shellExec(command);
	if (result.code) {
		process.exit(result.code);
	}
	return result;
}
