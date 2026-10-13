import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import { cardEffectVocabulary } from '../src/cardEffectVocabulary.ts'

const validators = createCardEffectValidators(cardEffectVocabulary)
test('bounded play grants retain permission and finalized-play continuation together', () => {
 const grant = { query: { players: 'self', cardTypes: ['unit'] }, modifiers: [], playTo: [{ action: 'allow', scope: 'sites' }], onPlayed: { addBuff: 1, routing: { subject: 'eventSubject' } }, uses: 1, consumeOn: 'finalized', duration: 'turn' }
 assert.equal(validators.isCardEffect({ effects: { played: [{ effect: { modifierGrant: grant } }] } }), true)
 for (const invalid of [{ ...grant, uses: 0 }, { ...grant, consumeOn: 'payment' }, { ...grant, onPlayed: { unsupported: true } }, { ...grant, playTo: [{ action: 'allow', scope: 'hand' }] }]) assert.equal(validators.isCardEffect({ effects: { played: [{ effect: { modifierGrant: invalid } }] } }), false)
})
test('choice usage is per option and independent of the enclosing trigger usage', () => {
 assert.equal(validators.isCardEffect({ effects: { onExhaust: [{ effect: { choice: { mode: 'effect', usage: 'oncePerTurn', options: [{ addBuff: 1 }, { draw: 1 }] } } }] } }), true)
 assert.equal(validators.isCardEffect({ effects: { onExhaust: [{ effect: { choice: { mode: 'effect', usage: 'unlimited', options: [{ draw: 1 }] } } }] } }), false)
})
test('ready restrictions admit current phases and reject unknown phases', () => {
 assert.equal(validators.isCardEffect({ effects: { canReady: [{ phase: 'beginning', targetQuery: { cardTypes: ['unit'] } }] } }), true)
 assert.equal(validators.isCardEffect({ effects: { canReady: [{ phase: 'combat' }] } }), false)
})
test('draw and discard events must match their destinations', () => {
 for (const change of [{ to: 'hand', event: 'draw' }, { to: 'hand', event: 'draw', source: { query: { source: { cards: 'selection' } } } }, { to: 'discard', event: 'discard' }]) assert.equal(validators.isCardEffect({ effects: { played: [{ effect: { zoneChanges: [change] } }] } }), true)
 for (const change of [{ to: 'hand', event: 'discard' }, { to: 'discard', event: 'draw' }, { to: 'hand', event: 'draw', timing: 'before' }]) assert.equal(validators.isCardEffect({ effects: { played: [{ effect: { zoneChanges: [change] } }] } }), false)
})
test('produced resources may restrict the payment source they pay for', () => {
	const gain = (costSource?: string) => ({ activatableEffects: [{ taps: true, effect: { addResource: { costs: [{ type: 'manaRecycle', amount: 1 }], cardTypes: ['unit', 'gear'], ...(costSource ? { costSource } : {}) } } }] })
	assert.equal(validators.isCardEffect(gain()), true)
	assert.equal(validators.isCardEffect(gain('cardPlay')), true)
	assert.equal(validators.isCardEffect(gain('activatedAbility')), true)
	assert.equal(validators.isCardEffect(gain('anyCost')), false)
})
