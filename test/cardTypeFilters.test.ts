import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchesCardTypes, intersectCardTypes, normalizeCardTypes, requiresCardType } from '../src/cardTypeFilters.ts'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import { cardEffectVocabulary } from '../src/cardEffectVocabulary.ts'
import type { CardTypeFilter } from '../src/cardEffectTypes.ts'

test('type alternatives require every trait in their own intersection', () => {
	const filter: CardTypeFilter = [['unit', 'bird'], ['gear', 'token']]
	for (let mask = 0; mask < 16; mask++) {
		const types = ['unit', 'bird', 'gear', 'token'].filter((_, index) => mask & 1 << index)
		assert.equal(matchesCardTypes(filter, type => types.includes(type)), types.includes('unit') && types.includes('bird') || types.includes('gear') && types.includes('token'))
	}
	assert.equal(matchesCardTypes(undefined, () => false), true)
	assert.equal(matchesCardTypes([], () => true), false)
	assert.equal(requiresCardType([['unit', 'bird'], ['unit', 'token']], 'unit'), true)
	assert.equal(requiresCardType(filter, 'unit'), false)
})

test('intersections distribute alternatives without widening captured subsets', () => {
	const pool: CardTypeFilter = ['unit', 'gear']
	const subset: CardTypeFilter = ['bird', 'token']
	const combined = intersectCardTypes(pool, subset)
	assert.deepEqual(combined, [['unit', 'bird'], ['unit', 'token'], ['gear', 'bird'], ['gear', 'token']])
	for (let mask = 0; mask < 16; mask++) {
		const types = ['unit', 'bird', 'gear', 'token'].filter((_, index) => mask & 1 << index)
		const has = (type: string) => types.includes(type)
		assert.equal(matchesCardTypes(combined, has), matchesCardTypes(pool, has) && matchesCardTypes(subset, has))
	}
	assert.deepEqual(normalizeCardTypes([['unit', 'bird', 'unit'], 'gear', ['gear', 'token'], ['bird', 'unit']]), [['unit', 'bird'], 'gear'])
	assert.deepEqual(intersectCardTypes([], subset), [])
})

test('query, event and destination validators accept only one level of type intersections', () => {
	const validators = createCardEffectValidators(cardEffectVocabulary)
	for (const cardTypes of [['unit'], ['unit', 'gear'], [['unit', 'bird'], 'gear'], []]) {
		assert.equal(validators.isQuery({ cardTypes }), true)
		assert.equal(validators.isConditional({ type: 'eventCount', event: 'played', cardTypes }), true)
		assert.equal(validators.isEffect({ play: { subject: 'selection', destination: { area: 'site', cardTypes } } }), true)
	}
	for (const cardTypes of [[[]], [[['unit']]], [1], [['unit', 1]]]) {
		assert.equal(validators.isQuery({ cardTypes }), false)
		assert.equal(validators.isConditional({ type: 'eventCount', event: 'played', cardTypes }), false)
		assert.equal(validators.isEffect({ play: { subject: 'selection', destination: { area: 'site', cardTypes } } }), false)
	}
	assert.equal(validators.isQuery({ allCardTypes: ['unit'] }), false)
})
