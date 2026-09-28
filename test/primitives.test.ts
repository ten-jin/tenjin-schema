import { test } from 'node:test'
import assert from 'node:assert/strict'
import { array, count, fields, literal, object, record, string, stringRecord, validate } from '../src/primitives.ts'

test('compiled objects snapshot maps; uncached fields use the current map', () => {
	const map = { value: string }
	const compiled = object(map)
	Object.assign(map, { value: count })
	assert.equal(compiled({ value: 'text' }), true)
	assert.equal(compiled({ value: 1 }), false)
	assert.equal(fields({ value: 1 }, map), true)
	assert.equal(fields({ value: 'text' }, map), false)
})

test('primitive validators compose contracts for unrelated game formats', () => {
	const chessPosition = (value: unknown) => record(value) && fields(value, { side: literal('white', 'black'), pieces: array(piece => record(piece) && fields(piece, { square: count, kind: literal('pawn', 'king') }, ['square', 'kind'])) }, ['side', 'pieces'])
	assert.equal(chessPosition({ side: 'white', pieces: [{ square: 4, kind: 'king' }] }), true)
	assert.equal(chessPosition({ side: 'white', pieces: [{ square: -1, kind: 'king' }] }), false)
	assert.equal(chessPosition({ side: 'white', pieces: [], typo: true }), false)
})

test('record keys do not become optional validator arguments', () => {
	const validator = stringRecord((value: unknown, strict = false) => !strict && count(value))
	assert.equal(validator({ first: 0 }), true)
	assert.deepEqual(validate({ second: -1 }, validator), { ok: false, issues: [{ path: 'second', expected: 'nonnegative safe integer' }] })
})
