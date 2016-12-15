import { assert } from 'chai';
import { mixin, on } from 'src/util';
import { EventEmitter } from 'events';
import registerSuite = require('intern!object');

registerSuite({
	mixin: {
		'target is null'() {
			const actual = mixin(null);
			assert.isNull(actual);
		},

		'one source; merged into target'() {
			const source = {
				property: 'one'
			};
			const target = {};
			const actual = mixin<{ property: string }>(target, source);

			assert.equal(actual, target);
			assert.property(actual, 'property');
			assert.strictEqual(actual.property, source.property);
		},

		'multiple sources; merged into target'() {
			const source: any[] = [
				{ property: 'one' },
				{ another: 'two' }
			];
			const target = {};
			const actual = mixin<{ property: string, another: string }>(target, ...source);

			assert.equal(actual, target);
			assert.deepEqual(actual, {
				property: 'one',
				another: 'two'
			});
		},

		'source overwrites target properties with the same name'() {
			const source = {
				property: 'one'
			};
			const target = {
				property: 'two'
			};
			const actual = mixin<{ property: string }>(target, source);

			assert.property(actual, 'property');
			assert.deepEqual(actual, {
				property: 'one'
			});
		},

		'multiple sources w/ same property; rightmost property is written to target'() {
			const source: any[] = [
				{ property: 'one' },
				{ property: 'two' }
			];
			const target = {};
			const actual = mixin<{ property: string }>(target, ...source);

			assert.deepEqual(actual, {
				property: 'two'
			});
		},

		'source property; merged into target'() {
			const source = {};
			Object.defineProperty(source, 'property', {
				value: 'one',
				enumerable: true
			});
			Object.defineProperty(source, 'nonenumerable', {
				value: 'two'
			});
			const target = {};
			const actual = mixin<{ property: string }>(target, source);

			assert.deepEqual(actual, {
				property: 'one'
			});
		}
	},

	on: {
		'attach to an event'() {
			const emitter = new EventEmitter();
			const event = 'test';
			let count = 0;
			const listener = () => count++;

			on(emitter, event, listener);
			emitter.emit(event, 'hello');
			assert.strictEqual(count, 1, 'expected listener to be called once');
		},

		'remove listener with handle'() {
			const emitter = new EventEmitter();
			const event = 'test';
			let called = false;
			const listener = () => called = true;

			const handle = on(emitter, event, listener);
			handle.remove();
			emitter.emit(event, 'hello');
			assert.isFalse(called, 'listener should not have been called');
		}
	}
});
