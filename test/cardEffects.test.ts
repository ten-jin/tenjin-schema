import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import { cardEffectVocabulary, type CardEffectVocabulary } from '../src/cardEffectVocabulary.ts'

const validators = createCardEffectValidators(cardEffectVocabulary)
const card = { id: 'test', name: 'Test', types: ['unit'], image: '', description: '', strength: 0, manaTap: 0, manaRecycle: 0, colors: [] }

const emptyVocabulary = {
	CARD_STATS: [],
	ACTION_WINDOWS: [],
	CARD_LOCATIONS: [],
	PLAYER_CARD_LOCATIONS: [],
	LOCATION_AREAS: [],
	PLAYER_TARGETS: [],
	COST_TYPES: [],
	MODIFIER_TYPES: [],
	CARD_TYPES: [],
	TURN_STEPS: [],
	EFFECT_KEYS: [],
	EFFECT_RULE_KEYS: [],
	SITE_CONDITIONALS: [],
	CORE_AMOUNTS: [],
	DAMAGE_AMOUNTS: [],
	CONDITIONAL_TYPES: [],
	EFFECT_INSTRUCTION_KINDS: [],
} as const satisfies CardEffectVocabulary
const vocabularyCard = { id: 'a', name: 'Example', types: ['ship'], image: '', description: '', strength: 0, manaTap: 0, manaRecycle: 0, colors: [] }

test('custom vocabulary narrows to schema-owned types', () => {
	const custom = createCardEffectValidators({ ...cardEffectVocabulary, CARD_LOCATIONS: ['orbit'], MODIFIER_TYPES: ['armor'] })
	const location: unknown = 'orbit'
	assert.equal(custom.cardLocation(location), true)
	if (custom.cardLocation(location)) { const narrowed: 'orbit' = location; assert.equal(narrowed, 'orbit') }
	const modifier: unknown = { type: 'armor', amount: 2 }
	if (custom.isModifier(modifier)) { const narrowed: 'armor' = modifier.type; assert.equal(narrowed, 'armor') } else assert.fail('expected valid modifier')
})

test('missing standard fields and semantic conflicts are explained', () => {
	const { description, ...missing } = card
	assert.deepEqual(validators.validateCard(missing), { ok: false, issues: [{ path: 'description', expected: 'required field' }] })
	assert.deepEqual(validators.validateEffect({ zoneChanges: [{ to: 'hand', placement: 'top' }] }), { ok: false, issues: [{ path: 'zoneChanges[0]', expected: 'placement only for mainDeck' }] })
	assert.deepEqual(validators.validateEffect({ select: { query: {}, min: 3, count: 2 } }), { ok: false, issues: [{ path: 'select', expected: 'min <= count' }] })
})

test('independent games supply their own event and modifier vocabularies', () => {
	const space = createCardEffectValidators({ ...emptyVocabulary, CARD_TYPES: ['ship'], EFFECT_KEYS: ['launch'], MODIFIER_TYPES: ['armor'] })
	const garden = createCardEffectValidators({ ...emptyVocabulary, CARD_TYPES: ['plant'], EFFECT_KEYS: ['bloom'], MODIFIER_TYPES: ['growth'] })
	const spaceCard = { ...vocabularyCard, ability: { effects: { launch: [{ effect: { modifiers: [{ type: 'armor', amount: -2 }] } }] } } }
	assert.equal(space.isExportedCardData(spaceCard), true)
	assert.equal(garden.isExportedCardData(spaceCard), false)
	const gardenCard = { ...vocabularyCard, types: ['plant'], ability: { effects: { bloom: [{ effect: { modifiers: [{ type: 'growth', amount: 2 }] } }] } } }
	assert.equal(garden.isExportedCardData(gardenCard), true)
	assert.equal(space.isExportedCardData(gardenCard), false)
})

test('semantic bounds and exclusive operations are enforced', () => {
	const validators = createCardEffectValidators(emptyVocabulary)
	for (const value of [-1, .5, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.equal(validators.isEffect({ draw: value }), false)
	assert.equal(validators.isEffect({ draw: 0, readies: { action: 'ready', amount: 0 } }), true)
	assert.equal(validators.isEffect({ zoneChanges: [{ to: 'hand' }, { to: 'discard' }] }), false)
	assert.equal(validators.isEffect({ zoneChanges: [{ to: 'hand', placement: 'top' }] }), false)
	for (const value of [true, {}]) assert.equal(validators.isEffect({ kills: value }), true)
	assert.equal(validators.isExportedCardData({ ...vocabularyCard, description: undefined }), false)
})

test('card limits and path indexes are nonnegative safe integers', () => {
	assert.equal(validators.isExportedCardData({ ...card, facedownCapacity: 1 }), false)
	assert.equal(validators.isExportedCardData({ ...card, winningScoreBonus: 1 }), false)
	assert.equal(validators.isExportedCardData({ ...card, ability: { effects: { passiveModifiers: [{ effect: { modifiers: [{ type: 'facedownCapacity', amount: 1 }, { type: 'winningScore', amount: 1 }] } }] } } }), true)
	for (const limit of [-1, .5, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
		assert.equal(validators.isExportedCardData({ ...card, copyLimit: limit }), false)
		assert.equal(validators.isExportedCardData({ ...card, playLimit: { cardType: 'unit', perTurn: limit } }), false)
		assert.equal(validators.isCardEffect({ buffLimit: limit }), false)
		assert.equal(validators.isCardEffect({ enhancementLimit: limit }), false)
		assert.equal(validators.effectPath(['flow', limit]), false)
	}
	for (const limit of [0, 1, Number.MAX_SAFE_INTEGER]) {
		assert.equal(validators.isExportedCardData({ ...card, copyLimit: limit, playLimit: { cardType: 'unit', perTurn: limit } }), true)
		assert.equal(validators.isCardEffect({ buffLimit: limit, enhancementLimit: limit }), true)
		assert.equal(validators.effectPath(['flow', limit]), true)
	}
	assert.equal(validators.isExportedCardData({ ...card, copyLimit: null, strength: -2, ability: { effects: { passiveModifiers: [{ effect: { modifiers: [{ type: 'facedownCapacity', amount: -1 }] } }] } } }), true)
	assert.equal(validators.isCardEffect({ buffLimit: null }), true)
})

test('non-JSON object instances are rejected', () => {
	for (const value of [new Date(), new Map(), /pattern/, new (class Example {})()]) {
		assert.equal(validators.isEffect(value), false)
		assert.deepEqual(validators.validateEffect(value), { ok: false, issues: [{ path: '$', expected: 'plain object' }] })
	}
	assert.equal(validators.isEffect(Object.create(null)), true)
})

test('cycles fail at the back-reference and shared subtrees remain valid', () => {
	const effect: { flow?: { unless: unknown } } = {}
	effect.flow = { unless: effect }
	assert.equal(validators.isEffect(effect), false)
	assert.deepEqual(validators.validateEffect(effect), { ok: false, issues: [{ path: 'flow.unless', expected: 'acyclic JSON data' }] })
	const shared = { draw: 1 }
	assert.equal(validators.isEffect({ flow: { branch: { success: shared, failure: shared } } }), true)
	assert.equal(validators.isEffect({ draw: 1 }), true)
})
