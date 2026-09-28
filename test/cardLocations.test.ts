import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import { cardEffectVocabulary } from '../src/cardEffectVocabulary.ts'
import { isInPlayLocation, isSiteLocation } from '../src/cardLocations.ts'

test('indexed sites accept positive safe integers and participate in the default vocabulary', () => {
	const validators = createCardEffectValidators(cardEffectVocabulary)
	for (const location of ['site-1', 'site-4', 'site-20', 'site-9007199254740991']) {
		assert.equal(isSiteLocation(location), true)
		assert.equal(isInPlayLocation(location), true)
		assert.equal(validators.cardLocation(location), true)
	}
	for (const location of ['site-*', 'site-0', 'site--1', 'site-1.5', 'site-01', 'site-9007199254740992', 'site-1e2', 'site-1\n', null]) {
		assert.equal(isSiteLocation(location), false)
		assert.equal(validators.cardLocation(location), false)
	}
	assert.equal(isInPlayLocation('mainCards'), true)
	assert.equal(isInPlayLocation('hand'), false)
})

test('custom vocabularies must opt into indexed sites', () => {
	const literals = createCardEffectValidators({ ...cardEffectVocabulary, CARD_LOCATIONS: ['orbit'] })
	assert.equal(literals.cardLocation('site-4'), false)
	const indexed = createCardEffectValidators({ ...cardEffectVocabulary, CARD_LOCATIONS: ['orbit', 'site-*'] })
	assert.equal(indexed.cardLocation('site-4'), true)
	assert.equal(indexed.cardLocation('orbit'), true)
	assert.equal(indexed.cardLocation('site-*'), false)
})
