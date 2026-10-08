import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import { cardEffectVocabulary } from '../src/cardEffectVocabulary.ts'

const validators = createCardEffectValidators(cardEffectVocabulary)
const options = [{ draw: 1 }, { draw: 2 }]

test('effect choices accept ordinary minimum and maximum counts', () => {
	for (const bounds of [{}, { min: 0 }, { count: 2, min: 0, distinct: true }, { count: 2, min: 1, distinct: true }, { count: 0 }]) {
		assert.equal(validators.isEffect({ choice: { mode: 'effect', options, ...bounds } }), true)
	}
})

test('choice minima are nonnegative safe integers', () => {
	for (const min of [-1, 1.5, Infinity, '0', null]) {
		assert.equal(validators.isEffect({ choice: { mode: 'effect', options, min } }), false)
	}
})

test('revealed-card matching choices do not take player selection bounds', () => {
	assert.equal(validators.isEffect({ choice: { mode: 'revealed', min: 0, options: [{ match: 'R', effect: { draw: 1 } }] } }), false)
})
