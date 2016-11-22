export interface Handle {
	remove(): void;
}

/**
 * Data that can be passed to tunnel providers to update the state of a job being executed on their service.
 */
export interface JobState {
	/**
	 * The build number of the software being tested by the job. Supported by Sauce Labs.
	 */
	buildId?: number;

	/**
	 * Additional arbitrary data to be stored alongside the job. Supported by TestingBot and Sauce Labs.
	 */
	extra?: {};

	/**
	 * A descriptive name for the job. Supported by TestingBot and Sauce Labs.
	 */
	name?: string;

	/**
	 * A status message to provide alongside a test. Supported by TestingBot.
	 */
	status?: string;

	/**
	 * Whether or not the job should be listed as successful. Supported by BrowserStack, TestingBot, and Sauce Labs.
	 */
	success: boolean;

	/**
	 * An array of tags for the job. Supported by TestingBot and Sauce Labs.
	 */
	tags?: string[];

	/**
	 * The public visibility of test results. May be one of 'public', 'public restricted', 'share', 'team', or 'private'.
	 * Supported by Sauce Labs.
	 */
	visibility?: string;
}

export interface Listener<EventType> {
	(event: EventType): void;
}
