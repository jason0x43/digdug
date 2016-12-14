const args = process.argv.slice(2);

const internArgs: {
	noClean?: boolean;
	showStdout?: boolean;
	verbose?: boolean;
	[arg: string]: any;
} = {};

args.filter(arg => {
	return /(\w+=.*|\w+$)/.test(arg);
}).forEach(arg => {
	if (/\w+=/.test(arg)) {
		const [ key, value ] = arg.split('=');
		internArgs[key] = value;
	}
	else {
		internArgs[arg] = true;
	}
});

export default internArgs;
