import assert from 'node:assert/strict'
import { test } from 'node:test'
import { cardEffectVocabulary } from '../src/cardEffectVocabulary.ts'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import type { EffectInstance } from '../src/cardEffectTypes.ts'

const validators = createCardEffectValidators(cardEffectVocabulary)

test('consumer keywords, stats, costs and phases remain local to their vocabulary', () => {
	const vocabulary = {
		...cardEffectVocabulary,
		CARD_STATS: [...cardEffectVocabulary.CARD_STATS, 'armor'],
		MODIFIER_TYPES: [...cardEffectVocabulary.MODIFIER_TYPES, 'fortified'],
		COST_TYPES: [...cardEffectVocabulary.COST_TYPES, 'fuel'],
		TURN_STEPS: [...cardEffectVocabulary.TURN_STEPS, 'dawn'],
	} as const
	const custom = createCardEffectValidators(vocabulary)
	const effect: EffectInstance<typeof vocabulary> = {
		modifiers: [{ type: 'fortified', amount: { stat: 'armor', card: 'recipient' } }],
		costs: { phase: 'dawn', costs: [{ type: 'fuel', amount: 1 }] },
	}
	assert.equal(custom.isEffect(effect), true)
	assert.equal(custom.isCardEffect({ effects: { played: [{ phase: 'dawn', effect }] } }), true)
	assert.equal(validators.isModifier(effect.modifiers![0]), false)
	assert.equal(validators.amount({ stat: 'armor', card: 'recipient' }), false)
	assert.equal(validators.isCost({ type: 'fuel', amount: 1 }), false)
	assert.equal(validators.isCostContainer({ phase: 'dawn', costs: [] }), false)
	assert.equal(validators.isDefinition({ phase: 'dawn', effect: { draw: 1 } }), false)
})

test('payment phases use the configured phase vocabulary and retain nested diagnostics', () => {
	assert.equal(validators.isEffect({ costs: { phase: 'main', costs: [] } }), true)
	assert.equal(validators.isDefinition({ costs: [{ phase: 'ending', costs: [] }], effect: { draw: 1 } }), true)
	for (const phase of [null, 1, 'unconfigured']) {
		const result = validators.validateEffect({ costs: { phase, costs: [] } })
		assert.equal(result.ok, false)
		if (!result.ok) assert.equal(result.issues[0]?.path, 'costs.phase')
	}
})

test('permission characteristics accept consumer tags and reject malformed tag values', () => {
	const permission = { from: 'discard', cost: 'normal', exit: 'banished', characteristic: 'return-once' }
	assert.equal(validators.isPlayPermission(permission), true)
	assert.equal(validators.isEffect({ modifiers: [{ type: 'playPermission', playPermission: permission }] }), true)
	assert.equal(validators.isCostContainer({ costs: [], playPermissionCharacteristics: ['return-once', 'reusable'] }), true)
	for (const characteristic of [1, null, [], {}]) {
		assert.equal(validators.isPlayPermission({ ...permission, characteristic }), false)
		assert.equal(validators.isCostContainer({ costs: [], playPermissionCharacteristics: [characteristic] }), false)
	}
})
