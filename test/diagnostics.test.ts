import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import { cardEffectVocabulary } from '../src/cardEffectVocabulary.ts'
import { array, count, literal, object, string, validate } from '../src/primitives.ts'

const validators = createCardEffectValidators(cardEffectVocabulary)
const card = { id: 'test', name: 'Test', types: ['unit'], image: '', description: '', strength: 0, manaTap: 0, manaRecycle: 0, colors: [] }

test('nested failures include card path, event key, index and expectation', () => {
	const value = { ...card, ability: { effects: { played: [{ effect: { draw: -1 } }] } } }
	assert.deepEqual(validators.validateCard(value, 'cards[12]'), { ok: false, issues: [{ path: 'cards[12].ability.effects.played[0].effect.draw', expected: 'nonnegative safe integer' }] })
})

test('unknown keys and array items have exact paths', () => {
	assert.deepEqual(validate({ labels: ['ok', 7] }, object({ labels: array(string) })), { ok: false, issues: [{ path: 'labels[1]', expected: 'string' }] })
	assert.deepEqual(validators.validateEffect({ draw: 0, typo: true }), { ok: false, issues: [{ path: 'typo', expected: 'known field' }] })
})

test('successful alternatives and diagnostic calls do not leak failures', () => {
	const validator = object({ choice: value => literal('none')(value) || count(value), tail: string })
	assert.deepEqual(validate({ choice: 0, tail: false }, validator), { ok: false, issues: [{ path: 'tail', expected: 'string' }] })
	assert.deepEqual(validate({ choice: 'none', tail: 'ok' }, validator), { ok: true })
	assert.equal(validator({ choice: 'none', tail: 'ok' }), true)
})

test('diagnostics follow the current occurrence of shared objects', () => {
	const shared = { amount: -1 }
	const validator = object({ ignored: () => true, checked: object({ amount: count }) })
	assert.deepEqual(validate({ ignored: shared, checked: shared }, validator), { ok: false, issues: [{ path: 'checked.amount', expected: 'nonnegative safe integer' }] })
	const otherValidator = object({ first: object({ amount: value => typeof value === 'number' }), second: array(object({ amount: count })) })
	assert.deepEqual(validate({ first: shared, second: [shared] }, otherValidator), { ok: false, issues: [{ path: 'second[0].amount', expected: 'nonnegative safe integer' }] })
})

test('validation only visits properties selected by the validator', () => {
	const ignored = { get unused() { throw new Error('should not be traversed') } }
	assert.deepEqual(validate({ ignored, count: 0 }, object({ ignored: () => true, count })), { ok: true })
})

test('nested diagnostic calls restore the outer traversal path', () => {
	const validator = object({ first: value => validate(value, object({ amount: count })).ok, last: string })
	assert.deepEqual(validate({ first: { amount: 0 }, last: 7 }, validator), { ok: false, issues: [{ path: 'last', expected: 'string' }] })
	assert.throws(() => validate({}, () => { throw new Error('custom failure') }), /custom failure/)
	assert.deepEqual(validate({ amount: -1 }, object({ amount: count })), { ok: false, issues: [{ path: 'amount', expected: 'nonnegative safe integer' }] })
})

test('choice, event, reference and relation arrays retain every path segment', () => {
	const cases: [unknown, string][] = [
		[{ choice: { mode: 'effect', options: [{ draw: 0 }, false] } }, 'choice.options[1]'],
		[{ choice: { mode: 'revealed', options: [{ match: 'A', effect: { draw: -1 } }] } }, 'choice.options[0].effect.draw'],
		[{ register: { played: [false] } }, 'register.played[0]'],
		[{ routing: { subject: ['effectSource', { from: 'selection', index: -1 }] } }, 'routing.subject[1].index'],
		[{ targetQuery: { relations: { attachedTo: [{ query: {}, min: -1 }] } } }, 'targetQuery.relations.attachedTo[0].min'],
		[{ modifiers: [{ type: 'strength', calculation: { operation: 'subtract', left: { stat: 'strength', card: { from: 'selection', index: -1 } }, right: { stat: 'strength', card: 'effectSource' } } }] }, 'modifiers[0].calculation.left.card.index'],
		[{ moves: { to: { card: { from: 'selection', index: -1 } } } }, 'moves.to.card.index'],
	]
	for (const [value, path] of cases) {
		const result = validators.validateEffect(value)
		assert.equal(result.ok, false)
		if (!result.ok) assert.equal(result.issues[0]?.path, path)
	}
	assert.equal(validators.isEffect({ choice: { mode: 'revealed', timing: 'target', options: [] } }), false)
})

test('array validators check missing elements rather than skipping them', () => {
	assert.deepEqual(validate(new Array(1), array(count)), { ok: false, issues: [{ path: '[0]', expected: 'nonnegative safe integer' }] })
	assert.equal(validators.effectPath(new Array(1)), false)
})
