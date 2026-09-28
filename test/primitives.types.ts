import { array, count, literal, object, string, stringRecord } from '../src/primitives.ts'

// These assertions are checked by tsc and never execute.
if (false) {
	object<{ count: number }>({ count }, ['count'])
	// @ts-expect-error a string validator cannot validate a numeric field
	object<{ count: number }>({ count: string }, ['count'])
	// @ts-expect-error collection output types propagate from their element validator
	object<{ counts: number[] }>({ counts: array(string) }, ['counts'])
	// @ts-expect-error literal values must belong to the declared field type
	object<{ mode: 'fast' }>({ mode: literal('slow') }, ['mode'])
	// @ts-expect-error record values must match the declared value type
	object<{ names: Record<string, string> }>({ names: stringRecord(count) }, ['names'])
}
