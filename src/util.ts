import { IHandle } from 'dojo/interfaces';
import EventEmitter = NodeJS.EventEmitter;

/**
 * Adds properties from source objects to a target object using ES5 `Object.defineProperty` instead of
 * `[[Set]]`. This is necessary when copying properties that are ES5 accessor/mutators.
 *
 * @param {Object} target The object to which properties are added.
 * @param {...Object} sources The source object from which properties are taken.
 * @returns {Object} The target object.
 */
export function mixin<T>(target: Object, ... sources: Object[]): T;
export function mixin<T, U>(target: Object, ... sources: Object[]): U;
export function mixin(target: Object, ... sources: Object[]): Object {
	for (let i = 0; i < sources.length; i++) {
		const source = sources[i];

		for (let key in source) {
			if (source.hasOwnProperty(key)) {
				Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
			}
		}
	}

	return target;
}

/**
 * Attaches an event to a Node.js EventEmitter and returns a handle for removing the listener later.
 *
 * @param {EventEmitter} emitter A Node.js EventEmitter object.
 * @param {string} event The name of the event to listen for.
 * @param {Function} listener The event listener that will be invoked when the event occurs.
 * @returns {{ remove: Function }} A remove handle.
 */
export function on(emitter: EventEmitter, event: string, listener: EventListener | Function): IHandle {
	emitter.on(event, listener);

	return {
		remove(this: IHandle) {
			this.remove = function () { };
			emitter.removeListener(event, listener);
		}
	}
}
