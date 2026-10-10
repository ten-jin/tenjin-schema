import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCardEffectValidators } from '../src/cardEffects.ts'
import { validate } from '../src/primitives.ts'
import { cardEffectVocabulary, type CardEffectVocabulary } from '../src/cardEffectVocabulary.ts'

const validators = createCardEffectValidators(cardEffectVocabulary)
const card = { id: 'test', name: 'Test', types: ['unit'], image: '', description: '', strength: 0, manaTap: 0, manaRecycle: 0, colors: [] }

const emptyVocabulary = {
	CARD_RELATION_TYPES: [],
	GAME_STATS: [],
	PLAYER_STATS: [],
	PLAYER_TURN_STATS: [],
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
	HISTORY_EVENTS: [],
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


test('effect contracts retain choices, dynamic amounts, and temporary lifetimes', () => {
	const ability = {
		additionalCosts: [{ optionality: 'optional', chooseOne: true, costs: [{ type: 'revealSelect', amount: 1, query: { cardTypes: ['unit'], players: 'self', source: { area: 'hand' } } }, { type: 'revealSelect', amount: 1, query: { cardTypes: ['unit'], players: 'team', source: { area: 'inPlay' } } }] }],
		setupChoices: { extras: { ifInDeck: { cardTypes: ['pool-provider'] }, query: { cardTypes: ['leader'] }, count: 3, distinctNames: true, excludeStarting: true } },
		effects: {
			canPlayTo: [{ playTo: [{ action: 'allow', scope: 'sites', exclusive: true }] }],
			hold: [{ targetQuery: { players: 'opponent', source: { area: 'here' } }, effect: { kills: true, routing: { subject: 'effectSource' } } }],
			onPlayed: [{ targetQuery: { cardTypes: [['gear', 'site-only']] }, effect: { draw: 1 } }],
			onStrengthReduced: [{ minimumEventAmount: 2, effect: { draw: 1 } }],
			onExhaust: [{ targetQuery: { source: { cards: 'effectSource' } }, effect: { draw: 1 } }],
			played: [{ effect: {
				choice: { mode: 'effect', count: 2, distinct: true, options: [{ draw: 1 }, { draw: 2 }] },
				flow: { forEach: { cards: 'selection', order: 'chosen', effect: { play: { subject: 'recipient', payment: false, controller: 'owner', destinations: ['lastLocation', 'base'] } } } },
				register: { onPlayed: [{ duration: 'turn', remainingUses: 3, usagePerPlayer: true, effect: { draw: 1 } }] },
				modifiers: [{ type: 'playPermission', subject: 'selection', duration: 'nextEnding', playPermission: { from: 'banished', cost: 'normal', exit: 'normal' } }],
				damage: { amount: { stat: 'strength', card: { from: 'costSelection', cost: 'revealSelect', index: 0 } } },
			} }],
		},
	}
	assert.equal(validators.isCardEffect(ability), true)
	assert.equal(validators.isEffect({ replacePlay: true, spawn: { name: 'mech', baseStrength: 3, count: { count: 'previousSelection' }, to: 'lastLocation' } }), true)
	assert.equal(validators.isEffect({ createCards: { from: { from: 'setupChoice', key: 'extras', index: 0 }, to: 'leader', duration: 'source' }, routing: { resolvingPlayer: 'eventController' } }), true)
	assert.equal(validators.isEffect({ singleRecipient: true, modifiers: [{ type: 'type', value: 'unit' }, { type: 'baseStrength', amount: 4 }] }), true)
})

test('effect fields remain strict for malformed quantities, lifetimes, and nested effects', () => {
	for (const remainingUses of [-1, 1.5, Infinity]) assert.equal(validators.isCardEffect({ effects: { onPlayed: [{ remainingUses, effect: { draw: 1 } }] } }), false)
	assert.equal(validators.isModifier({ type: 'site-only' }), false)
	assert.equal(validators.isEffect({ flow: { forEach: { cards: 'selection', effect: { draw: 1 } } } }), false)
	assert.equal(validators.isEffect({ flow: { forEach: { cards: 'selection', order: 'chosen', effect: { draw: -1 } } } }), false)
	assert.equal(validators.isEffect({ choice: { mode: 'effect', count: -1, options: [{ draw: 1 }] } }), false)
	assert.equal(validators.isEffect({ spawn: { name: 'mech', baseStrength: -1 } }), false)
	assert.equal(validators.isModifier({ type: 'playPermission', duration: 'nextMonth' }), false)
})

test('activation permissions, next-play grants, and selected banish costs validate strictly', () => {
	const grant = { query: { players: 'self', cardTypes: ['unit'] }, modifiers: [{ type: 'ready' }], uses: 1, consumeOn: 'finalized', duration: 'turn' }
	assert.equal(validators.isEffect({ modifierGrant: grant }), true)
	assert.equal(validators.isEffect({ modifierGrant: { ...grant, uses: 3 } }), true)
	assert.equal(validators.isEffect({ modifierGrant: { ...grant, consumeOn: 'damage' } }), false)
	for (const uses of [0, -1, 1.5, Infinity]) assert.equal(validators.isEffect({ modifierGrant: { ...grant, uses } }), false)
	assert.equal(validators.isEffect({ modifierGrant: { ...grant, duration: 'source' } }), false)
	assert.equal(validators.isEffect({ modifierGrant: { ...grant, query: { source: { area: 'unknown' } } } }), false)
	assert.equal(validators.isEffect({ modifierGrant: { ...grant, modifiers: [{ type: 'unknown' }] } }), false)
	for (const activationPlayers of ['controller', 'turnPlayer', 'all']) {
		assert.equal(validators.isCardEffect({ activatableEffects: [{ activationPlayers, usage: 'oncePerTurn', usagePerPlayer: true, effect: { draw: 1 } }] }), true)
	}
	assert.equal(validators.isCardEffect({ activatableEffects: [{ activationPlayers: 'opponent', effect: { draw: 1 } }] }), false)
	assert.equal(validators.isCardEffect({ activatableEffects: [{ costs: [{ costs: [{ type: 'banishSelect', amount: 1, query: { players: 'self', cardTypes: ['unit', 'gear'], source: { area: 'discard' } } }] }], effect: { draw: 1 } }] }), true)
})

test('optional reveal costs use existing choices and payment references', () => {
	const additionalCosts = [{ optionality: 'optional', chooseOne: true, costs: [
		{ type: 'revealSelect', amount: 1, query: { players: 'self', source: { area: 'hand' }, cardTypes: ['unit'] } },
		{ type: 'revealSelect', amount: 1, query: { players: 'team', source: { area: 'inPlay' }, cardTypes: ['unit'] } },
	] }]
	assert.equal(validators.isCardEffect({ additionalCosts }), true)
	assert.equal(validators.isCardEffect({ effects: { played: [{ conditionalsSource: [{ type: 'amount', amount: { count: { query: { source: { cards: { from: 'costSelection', cost: 'revealSelect' } }, exclude: 'recipient' }, card: 'recipient' } }, min: 1 }], effect: { damage: { amount: { stat: 'strength', card: { from: 'costSelection', cost: 'revealSelect', index: 0 } } } } }] } }), true)
	assert.equal(validators.isEffect({ damage: { amount: { stat: 'strength', card: { from: 'costSelection', cost: 'revealSelect' } } } }), false)
	assert.equal(validators.isCardEffect({ additionalCosts: [{ costs: [{ type: 'revealSelect', query: { source: { area: 'unknown' } } }] }] }), false)
})

test('single-recipient policy belongs to the effect and validates its modifier bundle', () => {
	const effect = { singleRecipient: true, select: { query: { players: 'team', cardTypes: ['gear'], source: { area: 'inPlay' } }, count: 1 }, modifiers: [{ type: 'type', value: 'unit' }, { type: 'baseStrength', amount: { stat: 'mana', card: 'recipient' } }] }
	assert.equal(validators.isEffect(effect), true)
	assert.equal(validators.isEffect({ ...effect, singleRecipient: false }), false)
	assert.equal(validators.isEffect({ ...effect, singleRecipient: 1 }), false)
	assert.equal(validators.isEffect({ ...effect, modifiers: [{ type: 'unknown' }] }), false)
	assert.equal(validators.isModifier({ type: 'type', value: 'unit', singleRecipient: true }), false)
})

test('string modifier payloads are scalar and retain vocabulary constraints', () => {
	assert.equal(validators.isModifier({ type: 'type', value: 'arbitrary-tag' }), true)
	assert.equal(validators.isModifier({ type: 'type', value: 'unit', replaceID: 'transformation' }), true)
	assert.equal(validators.isEffect({ modifiers: [{ type: 'actionWindows', value: 'contesting' }, { type: 'actionWindows', value: 'response' }] }), true)
	assert.equal(validators.isModifier({ type: 'actionWindows', value: 'unknown' }), false)
	assert.equal(validators.isModifier({ type: 'type', value: 1 }), false)
	assert.equal(validators.isModifier({ type: 'type', value: ['unit'] }), false)
	assert.equal(validators.isModifier({ type: 'type', value: 'unit', amount: 1 }), false)
	assert.equal(validators.isEffect({ modifiers: [{ type: 'type', value: 'unit', copyFrom: 'recipient' }] }), false)
	assert.equal(validators.isCardEffect({ actionWindows: ['response'], activatableEffects: [{ actionWindows: ['contesting'], effect: { draw: 1 } }] }), true)
})

test('granted abilities reuse ordinary definitions and reject malformed payloads', () => {
	const trigger = { combatRole: 'attacking', effect: { modifiers: [{ type: 'strength', amount: -2, duration: 'turn' }] } }
	assert.equal(validators.isEffect({ grantAbilities: { effects: { combat: [trigger] } } }), true)
	assert.equal(validators.isEffect({ grantAbilities: { activatableEffects: [{ taps: true, effect: { draw: 1 } }] } }), true)
	assert.equal(validators.isEffect({ grantAbilities: {} }), false)
	assert.equal(validators.isEffect({ grantAbilities: { effects: { combat: [{ ...trigger, combatRole: 'unknown' }] } } }), false)
	assert.equal(validators.isEffect({ grantAbilities: { effects: { combat: [{ effect: { draw: -1 } }] } } }), false)
	assert.equal(validators.isEffect({ grantAbilities: { setupChoices: {} } }), false)
})

test('ability grants share card behavior and support queried filtered copies with lifetimes', () => {
	const copy = { copyFrom: { players: 'self', source: { area: 'faceUp' }, cardTypes: ['leader', 'unit', 'gear'] }, fields: ['activatableEffects'], filter: { taps: true }, duration: 'turn' }
	assert.equal(validators.isEffect({ grantAbilities: copy }), true)
	assert.equal(validators.isEffect({ grantAbilities: { copyFrom: { source: { cards: 'affectingCard' } } } }), true)
	assert.equal(validators.isEffect({ grantAbilities: { playModifiers: [{ type: 'strength', amount: 2 }], actionWindows: ['response'], additionalCosts: [{ costs: [{ type: 'mana', amount: 1 }] }], costEffect: { draw: 1 } } }), true)
	assert.equal(validators.isEffect({ grantAbilities: { ...copy, copyFrom: { source: { area: 'unknown' } } } }), false)
	assert.equal(validators.isEffect({ grantAbilities: { ...copy, fields: ['unknown'] } }), false)
	assert.equal(validators.isEffect({ grantAbilities: { ...copy, filter: { taps: 1 } } }), false)
	assert.equal(validators.isEffect({ grantAbilities: { ...copy, duration: 'unknown' } }), false)
	assert.equal(validators.isEffect({ grantAbilities: { ...copy, effects: { played: [{ effect: { draw: 1 } }] } } }), false)
	assert.equal(validators.isEffect({ grantAbilities: { playModifiers: [{ type: 'unknown' }] } }), false)
})

test('amount expressions reference scoped payments and preserved card sets', () => {
	for (const amount of [{ payment: { cost: 'manaRecycle', group: 'additional' } }, { payment: { cost: 'mana' } }, { count: 'previousSelection' }, { count: { from: 'costSelection', cost: 'revealSelect' } }]) {
		assert.equal(validators.isEffect({ select: { query: { cardTypes: ['unit'] }, count: amount }, damage: { amount } }), true)
	}
	for (const amount of [{ payment: { cost: 'unknown' } }, { payment: { cost: 'mana', group: 1 } }, { count: 'unknown' }, { payment: { cost: 'mana' }, count: 'selection' }, { stat: 'strength', card: 'recipient', count: 'selection' }]) {
		assert.equal(validators.isEffect({ damage: { amount } }), false)
	}
})

test('setup choice pools and source-bound creation are independent of the card role', () => {
	const choice = { query: { cardTypes: ['gear'] }, count: 2, distinctNames: true, excludeStarting: true, ifInDeck: { names: ['Example'] } }
	assert.equal(validators.isCardEffect({ setupChoices: { tools: choice }, effects: { played: [{ effect: { select: { query: { source: { cards: { from: 'setupChoice', key: 'tools' } } }, count: 1 }, createCards: { from: 'selection', to: 'hand', duration: 'source' } } }] } }), true)
	for (const count of [0, -1, 1.5, Infinity]) assert.equal(validators.isCardEffect({ setupChoices: { tools: { ...choice, count } } }), false)
	assert.equal(validators.isCardEffect({ setupChoices: { tools: { ...choice, query: { source: { area: 'unknown' } } } } }), false)
	assert.equal(validators.isEffect({ createCards: { from: { from: 'setupChoice' }, to: 'leader' } }), false)
	assert.equal(validators.isEffect({ createCards: { from: 'selection', to: 'unknown' } }), false)
	assert.equal(validators.isEffect({ createCards: { from: 'selection', to: 'leader', duration: 'turn' } }), false)
	assert.equal(validators.isEffect({ damage: { amount: { stat: 'strength', card: { from: 'setupChoice', key: 'tools' } } } }), false)
	assert.equal(validators.isEffect({ damage: { amount: { stat: 'strength', card: { from: 'setupChoice', key: 'tools', index: 0 } } } }), true)
})

test('registered triggers match players through captured scalar card references', () => {
	const effect = { register: { hold: [{ captureTargets: true, remainingUses: 1, initiatingPlayer: { ownerOf: { from: 'previousSelection' } }, effect: { zoneChanges: [{ to: 'hand' }], routing: { subject: 'previousSelection' } } }] } }
	assert.equal(validators.isEffect(effect), true)
	assert.equal(validators.isCardEffect({ effects: { onKill: [{ initiatingPlayer: { controllerOf: 'eventSubject' }, effect: { draw: 1 } }] } }), true)
	for (const initiatingPlayer of [{ ownerOf: 'selection' }, { ownerOf: 'unknown' }, { ownerOf: 'recipient', controllerOf: 'recipient' }, { ownerOf: { from: 'setupChoice', key: 'pool' } }]) {
		assert.equal(validators.isEffect({ register: { hold: [{ ...effect.register.hold[0], initiatingPlayer }] } }), false)
	}
})

test('amount expressions use queries, aggregates and configured player stats in all amount positions', () => {
	const expressions = [
		{ count: { query: { players: 'self', source: { area: 'discard' } } } },
		...['min', 'max', 'sum'].map(operation => ({ aggregate: { operation, stat: 'strength', query: { cardTypes: ['unit'] } } })),
		{ playerStat: { stat: 'points', player: 'self' } },
		{ playerStat: { stat: 'xp', player: { controllerOf: 'recipient' } } },
	]
	for (const amount of expressions) {
		assert.equal(validators.isEffect({ damage: { amount }, select: { query: {}, count: amount }, modifiers: [{ type: 'strength', amount }], costs: { costs: [{ type: 'mana', amount, multiplier: amount }] } }), true)
	}
	for (const amount of [
		{ count: { query: { source: { area: 'unknown' } } } },
		{ aggregate: { operation: 'mean', stat: 'strength', query: {} } },
		{ aggregate: { operation: 'max', stat: 'unknown', query: {} } },
		{ aggregate: { operation: 'sum', stat: 'strength' } },
		{ playerStat: { stat: 'unknown', player: 'self' } },
		{ playerStat: { stat: 'points', player: { ownerOf: 'selection' } } },
		{ count: 'selection', aggregate: { operation: 'max', stat: 'strength', query: {} } },
	]) assert.equal(validators.isEffect({ damage: { amount } }), false)
	const custom = createCardEffectValidators({ ...cardEffectVocabulary, PLAYER_STATS: ['victory'] })
	assert.equal(custom.isEffect({ damage: { amount: { playerStat: { stat: 'victory', player: 'self' } } } }), true)
	assert.equal(custom.isEffect({ damage: { amount: { playerStat: { stat: 'points', player: 'self' } } } }), false)
})

test('temporary status shares the existing modifier, conditional, suppression and spawn status contracts', () => {
	assert.equal(validators.isModifier({ type: 'temporary' }), true)
	assert.equal(validators.isEffect({ modifiers: [{ type: 'temporary', copyFrom: 'affectingCard', duration: 'turn' }], disablesEffect: 'temporary' }), true)
	assert.equal(validators.isQuery({ conditional: [{ type: 'temporary', not: true }] }), true)
	assert.equal(validators.isEffect({ spawn: { name: 'sprite', statuses: ['ready', 'temporary'] } }), true)
})

test('subtraction amounts compose ordinary expressions across modifiers, damage and costs', () => {
	const amount = { calculation: { operation: 'subtract', left: { stat: 'strength', card: 'recipient' }, right: { payment: { cost: 'manaRecycle', group: 'additional' } }, minimum: 0 } }
	assert.equal(validators.isEffect({ damage: { amount }, modifiers: [{ type: 'strength', amount }], costs: { costs: [{ type: 'mana', amount }] }, drawMana: { amount }, spawn: { name: 'example', count: amount } }), true)
	assert.equal(validators.isModifier({ type: 'strength', amount }), true)
	assert.equal(validators.amount({ calculation: { operation: 'subtract', left: amount, right: 2 } }), true)
	for (const calculation of [
		{ operation: 'subtract', left: 1 },
		{ operation: 'divide', left: 1, right: 2 },
		{ operation: 'subtract', left: { stat: 'unknown', card: 'recipient' }, right: 1 },
		{ operation: 'subtract', left: 1, right: { payment: { cost: 'unknown' } } },
		{ operation: 'subtract', left: 1, right: 2, minimum: 'zero' },
	]) assert.equal(validators.amount({ calculation }), false)
	assert.equal(validators.isEffect({ modifiers: [{ type: 'strength', amount, copyFrom: 'recipient' }] }), false)
	const cycle: Record<string, unknown> = { calculation: { operation: 'subtract', left: 2, right: 1 } }
	;(cycle.calculation as Record<string, unknown>).left = cycle
	assert.equal(validators.amount(cycle), false)
})

test('resource draw counts share payment expressions and retain nonnegative literal counts', () => {
	assert.equal(validators.isEffect({ drawMana: { amount: { payment: { cost: 'buffSelect' } }, isReady: true } }), true)
	assert.equal(validators.isEffect({ drawMana: { amount: 0 } }), true)
	assert.equal(validators.isEffect({ drawMana: { amount: -1 } }), false)
	assert.equal(validators.isEffect({ drawMana: { amount: { payment: { cost: 'unknown' } } } }), false)
})


test('activation reductions accept counts, conditional costs and prepayment target stats', () => {
	const base = { costs: [{ type: 'mana', amount: 3 }, { type: 'manaRecycle', amount: 1 }], costReduction: [{ type: 'mana', amount: { stat: 'strength', card: { from: 'selection' }, previous: true } }] }
	assert.equal(validators.isDefinition({ costs: [base], effect: { attaches: true, select: { query: { cardTypes: ['unit'] }, count: 1 } } }), true)
	assert.equal(validators.isCostContainer({ costs: [{ type: 'mana', amount: 12 }], costReduction: [{ type: 'mana', amount: { count: { query: { cardTypes: ['resource'], source: { area: 'manaCards' } } } }, conditional: [{ type: 'amount', amount: { count: { query: { cardTypes: ['resource'], exclude: 'recipient' }, card: 'recipient' } }, max: 4 }] }] }), true)
	assert.equal(validators.isCostContainer({ costs: [], costReduction: [{ type: 'mana', amount: -1 }] }), true)
	for (const reduction of [
		{ type: 'unknown', amount: 2 },
		{ type: 'mana', amount: { stat: 'unknown', card: { from: 'selection' } } },
		{ type: 'mana', amount: { count: { query: { source: { area: 'unknown' } } } } },
		{ type: 'mana', amount: 2, conditional: [{ type: 'amount', amount: { count: { query: { cardTypes: ['unit'], exclude: 'recipient' }, card: 'recipient' } }, max: 'four' }] },
	]) assert.equal(validators.isCostContainer({ costs: base.costs, costReduction: [reduction] }), false)
})

test('compact control and recall retain duration, source routing and exhaust instructions', () => {
	assert.equal(validators.isEffect({ control: { recalls: true }, readies: { action: 'exhaust' }, select: { query: { players: 'opponent', cardTypes: ['unit'] }, count: 1 }, routing: { subject: 'selection' } }), true)
	assert.equal(validators.isEffect({ control: { recalls: true, duration: 'turn', returns: true }, routing: { subject: 'effectSource' } }), true)
	assert.equal(validators.isEffect({ moves: { type: 'recall' }, routing: { subject: 'previousSelection' } }), true)
	assert.equal(validators.isEffect({ control: { recalls: 'base' } }), false)
	assert.equal(validators.isEffect({ control: { recalls: true, duration: 'forever' } }), false)
})

test('numeric modifier floors are independent of amount clamps and allow other stat values', () => {
	const custom = createCardEffectValidators({ ...cardEffectVocabulary, MODIFIER_TYPES: ['armor'] })
	assert.equal(custom.isModifier({ type: 'armor', amount: -5, minimum: 2 }), true)
	assert.equal(validators.isModifier({ type: 'strength', amount: { calculation: { operation: 'subtract', left: 2, right: 5, minimum: -2 } }, minimum: 1, duration: 'turn' }), true)
	for (const minimum of [true, 'one', NaN, Infinity]) assert.equal(validators.isModifier({ type: 'strength', amount: -2, minimum }), false)
})


test('comparisons accept the shared amount expressions, including count queries and nested subtraction', () => {
	const query = { players: 'opponent', cardTypes: ['resource'], source: { area: 'manaCards' } }
	for (const value of [2, { count: { query } }, { calculation: { operation: 'subtract', left: { count: { query } }, right: 1, minimum: 0 } }, { playerStat: { stat: 'points', player: 'self' } }]) {
		assert.equal(validators.isCompare({ operator: '<', value }), true)
		assert.equal(validators.isCompareValue(value), true)
		assert.equal(validators.isConditional({ type: 'amount', amount: { count: { query: { ...query, exclude: 'recipient' }, card: 'recipient' } }, compare: { operator: '<', value } }), true)
	}
	assert.equal(validators.isCompare({ value: { count: { query: { source: { area: 'unknown' } } } } }), false)
	assert.equal(validators.isCompare({ value: { count: { query } }, operator: 'approximately' }), false)
})

test('movement payments accept shared batch count expressions and ordinary cost quantities', () => {
	const multiplier = { calculation: { operation: 'subtract', left: { count: { query: { source: { cards: 'selection' }, cardTypes: ['unit'], players: 'all' } } }, right: 1, minimum: 0 } }
	assert.equal(validators.isDefinition({ sourceArea: 'site', targetQuery: { players: 'opponent' }, moveTo: [{ action: 'allow', scope: 'here', costs: { costs: [{ type: 'manaRecycle', amount: 2, multiplier }] } }] }), true)
	assert.equal(validators.isDefinition({ moveTo: [{ action: 'allow', scope: 'here', costs: { costs: [{ type: 'manaRecycle', amount: 1, multiplier: { calculation: { operation: 'subtract', left: { count: { query: { source: { cards: 'missing' } } } }, right: 1 } } }] } }] }), false)
})

test('split damage supports fixed and dynamic budgets while validating recipients and mode', () => {
	for (const amount of [5, { stat: 'attack', card: { from: 'previousSelection' } }]) assert.equal(validators.isEffect({ damage: { amount, distribution: 'split' }, select: { query: { players: 'opponent', cardTypes: ['unit'] }, min: 0, count: amount } }), true)
	assert.equal(validators.isEffect({ damage: { amount: 5, distribution: 'spread' } }), false)
	assert.equal(validators.isEffect({ damage: { amount: 5, distribution: true } }), false)
	assert.equal(validators.isEffect({ damage: { amount: { stat: 'missing', card: 'effectSource' }, distribution: 'split' } }), false)
	assert.equal(validators.isEffect({ damage: { amount: 5, distribution: 'split' }, select: { query: {}, min: 2, count: 1 } }), false)
	assert.equal(validators.isEffect({ damage: { amount: { stat: 'attack', card: 'effectSource' }, reciprocal: true } }), true)
})


test('draw, XP and spawn accept shared count expressions with validated queries and references', () => {
	for (const amount of [
		0, 2,
		{ count: { query: { players: 'self', cardTypes: ['unit'], source: { area: 'inPlay' } } } },
		{ count: { from: 'previousSelection' } },
		{ payment: { cost: 'manaRecycle', group: 'additional' } },
		{ stat: 'strength', card: { from: 'costSelection', cost: 'revealSelect', index: 0 } },
		{ aggregate: { operation: 'max', stat: 'strength', query: { cardTypes: ['unit'] } } },
		{ playerStat: { stat: 'xp', player: 'self' } },
		{ calculation: { operation: 'subtract', left: { count: 'selection' }, right: 1, minimum: 0 } },
	]) assert.equal(validators.isEffect({ draw: amount, gainXP: amount, spawn: { name: 'example', count: amount } }), true)
	for (const amount of [-1, .5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, 'infinityCost', {},
		{ count: 'missing' }, { count: { query: { source: { area: 'unknown' } } } },
		{ payment: { cost: 'unknown' } }, { stat: 'unknown', card: 'affectingCard' },
	]) {
		assert.equal(validators.isEffect({ draw: amount }), false)
		assert.equal(validators.isEffect({ gainXP: amount }), false)
	}
})

test('distinct type counts compose with ordinary amounts and computed count requirements', () => {
	for (const distinctTypes of [['bird', 'cat', 'dog', 'fox'], [], ['custom-tag', 'custom-tag']]) {
		const amount = { count: { query: { cardTypes: ['unit'], source: { area: 'inPlay' } }, distinctTypes } }
		assert.equal(validators.isEffect({ modifiers: [{ type: 'strength', amount }], costs: { costs: [{ type: 'mana', amount: 2, multiplier: amount }] }, draw: amount, requirements: { cards: { count: amount, min: 0, max: 4 } } }), true)
		assert.equal(validators.isConditional({ type: 'amount', amount: { count: { query: { exclude: 'recipient' }, card: 'recipient' } }, compare: { operator: '>=', value: amount } }), true)
	}
	for (const count of [0, { count: 'previousSelection' }, { payment: { cost: 'manaRecycle', group: 'additional' } }]) assert.equal(validators.isEffect({ requirements: { cards: { count, min: 0, max: 4 } } }), true)
	for (const count of [-1, { count: { distinctTypes: ['bird'] } }, { count: { query: {}, distinctTypes: [1] } }, { count: { query: { source: { area: 'unknown' } }, distinctTypes: ['bird'] } }]) assert.equal(validators.isEffect({ requirements: { cards: { count } } }), false)
	assert.equal(validators.isEffect({ requirements: { cards: { count: 4, query: {} } } }), false)
	assert.equal(validators.isEffect({ requirements: { cards: { count: 4, min: 5, max: 4 } } }), false)
})

test('normal play payment policies share configured costs and preserve replay and copy contracts', () => {
	for (const payment of [true, false, { waive: ['mana'] }, { costReduction: [{ type: 'mana', amount: { stat: 'strength', card: { from: 'previousSelection' }, previous: true } }] }, { waive: ['manaRecycle'], costReduction: [{ type: 'mana', amount: 2, multiplier: { count: 'previousSelection' } }] }]) assert.equal(validators.isEffect({ play: { subject: 'selection', payment, controller: 'owner', destination: 'base' } }), true)
	for (const payment of ['free', {}, { waive: 'mana' }, { waive: ['unknown'] }, { costReduction: [{ type: 'unknown', amount: 1 }] }, { costReduction: [{ type: 'mana', amount: { stat: 'unknown', card: 'recipient' } }] }]) assert.equal(validators.isEffect({ play: { subject: 'selection', payment } }), false)
	assert.equal(validators.isEffect({ play: { subject: 'selection' } }), true)
	assert.equal(validators.isEffect({ play: { mode: 'replay', subject: 'effectTarget', costs: { costs: [{ type: 'manaRecycle', amount: 1 }] } } }), true)
	assert.equal(validators.isEffect({ play: { mode: 'copy', subject: 'eventSubject', copies: 1 } }), true)
	const custom = createCardEffectValidators({ ...cardEffectVocabulary, COST_TYPES: ['fuel', 'crystals'] })
	assert.equal(custom.isEffect({ play: { subject: 'selection', payment: { waive: ['fuel'], costReduction: [{ type: 'crystals', amount: 2 }] } } }), true)
	assert.equal(custom.isEffect({ play: { subject: 'selection', payment: { waive: ['mana'] } } }), false)
})


test('shared arithmetic composes counts, payments, stats and configured amount references', () => {
	const queryCount = { count: { query: { source: { area: 'discard' } } } }
	for (const operation of ['add', 'subtract', 'multiply']) {
		const value = { calculation: { operation, left: { payment: { cost: 'mana' } }, right: queryCount, minimum: 0 } }
		assert.equal(validators.isEffect({ damage: { amount: value }, draw: value, gainXP: value, modifiers: [{ type: 'strength', amount: value }], costs: { costs: [{ type: 'mana', amount: value }] } }), true)
	}
	const nested = { calculation: { operation: 'add', left: 2, right: { calculation: { operation: 'multiply', left: 3, right: queryCount } } } }
	assert.equal(validators.amount(nested), true)
	assert.equal(validators.isEffect({ damage: { amount: { calculation: { operation: 'add', left: 'excessDamage', right: 1 } } } }), true)
	for (const calculation of [
		{ operation: 'multiply', left: 2 },
		{ operation: 'divide', left: 2, right: 1 },
		{ operation: 'add', left: 2, right: { count: { query: { source: { cards: 'missing' } } } } },
		{ operation: 'multiply', left: 'unknownAmount', right: 2 },
		{ operation: 'add', left: 1, right: 2, minimum: '0' },
	]) assert.equal(validators.amount({ calculation }), false)
})

test('event counts share amount consumers and distinguish source and subject references', () => {
	for (const role of ['source', 'subject']) {
		const amount = { count: { event: 'damaged', card: { from: 'previousSelection', index: 0 }, role, window: 'turn' } }
		assert.equal(validators.isEffect({ damage: { amount }, draw: amount, spawn: { name: 'token', count: amount }, modifiers: [{ type: 'strength', amount }] }), true)
	}
	const event = { event: 'damaged', card: 'effectSource', role: 'source', window: 'turn' }
	for (const count of [{ ...event, event: 'unknown' }, { ...event, card: ['effectSource', 'recipient'] }, { ...event, card: 'missing' }, { ...event, role: 'controller' }, { ...event, window: 'game' }, { ...event, query: {} }]) assert.equal(validators.amount({ count }), false)
	const { window, ...missingWindow } = event
	assert.equal(validators.amount({ count: missingWindow }), false)
	const space = createCardEffectValidators({ ...emptyVocabulary, EFFECT_KEYS: ['launch'], HISTORY_EVENTS: ['launch'] })
	assert.equal(space.amount({ count: { ...event, event: 'launch' } }), true)
	assert.equal(space.amount({ count: event }), false)
})

test('numeric conditions reuse ordinary operands and existing bounds and comparison lists', () => {
	const amount = { calculation: { operation: 'add', left: { count: { event: 'moved', card: 'recipient', role: 'subject', window: 'turn' } }, right: { payment: { cost: 'mana' } } } }
	const conditional = { type: 'amount', amount, min: 0, max: { playerStat: { stat: 'points', player: 'self' } }, compare: [{ operator: '!=', value: 2 }, { operator: '<', value: { aggregate: { operation: 'sum', stat: 'strength', query: { source: { cards: ['selection', 'recipient'] }, players: 'all' } } } }], not: true }
	assert.equal(validators.isDefinition({ conditionalsSource: [conditional], conditionalsTarget: [conditional], effect: { draw: 1 } }), true)
	assert.equal(validators.isEffect({ select: { query: { conditional: [conditional] }, min: 0 } }), true)
	assert.equal(validators.isConditional({ type: 'amount', amount: 0, max: 0 }), true)
	assert.equal(validators.isConditional({ type: 'amount', amount: -1, min: -2 }), true)
})

test('numeric conditions require a valid operand and respect configured vocabularies', () => {
	for (const conditional of [
		{ type: 'amount', min: 0 },
		{ type: 'amount', amount: { count: { event: 'unknown', card: 'recipient', role: 'subject', window: 'turn' } }, max: 0 },
		{ type: 'amount', amount: { aggregate: { operation: 'sum', stat: 'strength', query: { source: { cards: 'missing' } } } } },
		{ type: 'amount', amount: 1, compare: { operator: 'near', value: 2 } },
		{ type: 'tapped', amount: 1, min: 0 },
	]) assert.equal(validators.isConditional(conditional), false)
	const space = createCardEffectValidators({ ...emptyVocabulary, CONDITIONAL_TYPES: ['amount'], CARD_STATS: ['armor'], EFFECT_KEYS: ['launch'], HISTORY_EVENTS: ['launch'] })
	assert.equal(space.isConditional({ type: 'amount', amount: { aggregate: { operation: 'sum', stat: 'armor', query: {} } }, min: 2 }), true)
	assert.equal(space.isConditional({ type: 'amount', amount: { count: { event: 'launch', card: 'recipient', role: 'subject', window: 'turn' } }, compare: { value: 1 } }), true)
	assert.equal(space.isConditional({ type: 'amount', amount: { stat: 'strength', card: 'recipient' }, min: 2 }), false)
	assert.equal(createCardEffectValidators(emptyVocabulary).isConditional({ type: 'amount', amount: 1, min: 0 }), false)
})

test('event counts can restrict any configured event and role to the current game object', () => {
	for (const role of ['source', 'subject']) {
		const count = { event: 'moved', card: 'recipient', role, window: 'turn', currentObject: true }
		assert.equal(validators.isConditional({ type: 'amount', amount: { count }, compare: { value: 2 } }), true)
		assert.equal(validators.amount({ count: { ...count, currentObject: false } }), false)
	}
	assert.equal(validators.amount({ count: { event: 'damaged', card: 'effectSource', role: 'source', window: 'turn' } }), true)
})


test('numeric stat conditions retain controller references, captures and payment guards', () => {
	for (const stat of ['strength', 'attack', 'mana', 'manaRecycle', 'damage']) {
		assert.equal(validators.isConditional({ type: 'amount', amount: { stat, card: 'recipient' }, max: { stat, card: { from: 'previousSelection', index: 0 }, previous: true }, unlessPaidAdditionalCost: true }), true)
	}
	for (const stat of ['points', 'xp']) {
		assert.equal(validators.isConditional({ type: 'amount', amount: { playerStat: { stat, player: { controllerOf: 'recipient' } } }, min: 0, max: 5 }), true)
	}
	assert.equal(validators.isConditional({ type: 'amount', amount: { stat: 'damage', card: 'recipient' }, not: true }), true)
})


test('query-count anchors share scalar references and compose with all amount consumers', () => {
	for (const card of ['recipient', 'affectingCard', { from: 'previousSelection', index: 0 }, { from: 'previousSelection', index: -1 }]) {
		const amount = { count: { query: { source: { area: 'here' }, cardTypes: ['unit'], exclude: 'recipient' }, card, distinctTypes: ['unit', 'gear'] } }
		assert.equal(validators.isConditional({ type: 'amount', amount, min: 0, max: 2 }), true)
		assert.equal(validators.isEffect({ draw: amount, modifiers: [{ type: 'strength', amount }], costs: { costs: [{ type: 'mana', amount }] } }), true)
	}
	for (const card of ['missing', ['recipient'], { from: 'previousSelection', index: -0.5 }]) assert.equal(validators.amount({ count: { query: {}, card } }), false)
	assert.equal(validators.amount({ count: { query: {} } }), true)
})

test('selection references accept signed safe integer indexes while setup and payment indexes remain nonnegative', () => {
	for (const from of ['selection', 'previousSelection']) for (const index of [-3, -1, 0, 2]) {
		const card = { from, index }
		assert.equal(validators.isEffect({ damage: { amount: { stat: 'strength', card } }, routing: { subject: card } }), true)
	}
	for (const index of [-0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) assert.equal(validators.isEffect({ routing: { subject: { from: 'previousSelection', index } } }), false)
	for (const card of [{ from: 'setupChoice', key: 'test', index: -1 }, { from: 'costSelection', cost: 'revealSelect', index: -1 }]) assert.equal(validators.isEffect({ routing: { subject: card } }), false)
})


test('game stats compose with arithmetic, comparisons and ordinary amount consumers', () => {
	const round = { gameStat: { stat: 'roundNumber' } }
	const amount = { calculation: { operation: 'add', left: round, right: { stat: 'buff', card: 'recipient' } } }
	assert.equal(validators.isEffect({ draw: amount, gainXP: round, damage: { amount }, costs: { costs: [{ type: 'mana', amount }] }, modifiers: [{ type: 'strength', amount }], spawn: { name: 'example', count: round }, requirements: { cards: { count: round, min: 0 } } }), true)
	assert.equal(validators.isConditional({ type: 'amount', amount: round, min: 0, compare: { operator: '<=', value: amount } }), true)
	for (const stat of ['buff', 'enhanced']) {
		assert.equal(validators.isConditional({ type: 'amount', amount: { stat, card: 'recipient' }, min: 0, not: true }), true)
		assert.equal(validators.amount({ aggregate: { operation: 'sum', stat, query: {} } }), true)
	}
})

test('game-stat names are configured independently of card and player stat names', () => {
	const customVocabulary = { ...emptyVocabulary, GAME_STATS: ['cycles'], CARD_STATS: ['armor'], PLAYER_STATS: ['victory'], CONDITIONAL_TYPES: ['amount'] } as const
	const custom = createCardEffectValidators(customVocabulary)
	const gameAmount: import('../src/cardEffectTypes.ts').AmountExpression<typeof customVocabulary> = { gameStat: { stat: 'cycles' } }
	assert.equal(custom.isConditional({ type: 'amount', amount: gameAmount, max: 2 }), true)
	assert.equal(custom.amount({ gameStat: { stat: 'roundNumber' } }), false)
	assert.equal(custom.amount({ gameStat: { stat: 'victory' } }), false)
	assert.equal(validators.amount({ gameStat: { stat: 'cycles' } }), false)
	assert.equal(createCardEffectValidators(emptyVocabulary).amount({ gameStat: { stat: 'roundNumber' } }), false)
	for (const gameStat of [{}, { stat: 1 }, { stat: 'roundNumber', player: 'self' }]) assert.equal(validators.amount({ gameStat }), false)
})


test('remaining instruction counts share expressions and retain nonnegative integer literals', () => {
	const consumers = [
		(amount: unknown) => ({ flow: { repeat: amount } }),
		(amount: unknown) => ({ triggerRepeat: { key: 'hold', amount } }),
		(copies: unknown) => ({ play: { mode: 'copy', subject: 'eventSubject', copies } }),
		(amount: unknown) => ({ readies: { action: 'toggle', amount } }),
		(preScry: unknown) => ({ preScry }),
	]
	for (const consume of consumers) {
		for (const value of [0, 1, Number.MAX_SAFE_INTEGER, { count: 'previousSelection' }, { payment: { cost: 'manaRecycle', group: 'additional' } }, { calculation: { operation: 'subtract', left: { count: { query: { source: { area: 'discard' } } } }, right: 1, minimum: 0 } }]) assert.equal(validators.isEffect(consume(value)), true)
		for (const value of [-1, .5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, { calculation: { operation: 'add', left: 1, right: { stat: 'unknown', card: 'recipient' } } }]) assert.equal(validators.isEffect(consume(value)), false)
	}
})

test('card and point adjustments accept signed shared amounts without count restrictions', () => {
	for (const value of [-2, 0, .5, { calculation: { operation: 'subtract', left: 0, right: { stat: 'buff', card: 'recipient' } } }, { playerStat: { stat: 'points', player: 'self' } }]) assert.equal(validators.isEffect({ addBuff: value, addPoints: value }), true)
	for (const value of [Infinity, NaN, {}, { count: { event: 'unknown', card: 'recipient', role: 'subject', window: 'turn' } }]) {
		assert.equal(validators.isEffect({ addBuff: value }), false)
		assert.equal(validators.isEffect({ addPoints: value }), false)
	}
})

test('instruction expressions propagate custom stat and event vocabularies through every consumer', () => {
	const vocabulary = { ...emptyVocabulary, CARD_STATS: ['armor'], EFFECT_KEYS: ['launch'], HISTORY_EVENTS: ['launch'] } as const
	const custom = createCardEffectValidators(vocabulary)
	const amount = { calculation: { operation: 'add', left: { stat: 'armor', card: 'recipient' }, right: { count: { event: 'launch', card: 'effectSource', role: 'source', window: 'turn' } } } } as const
	const effect: import('../src/cardEffectTypes.ts').EffectInstance<typeof vocabulary> = { flow: { repeat: amount }, triggerRepeat: { key: 'launch', amount }, play: { mode: 'copy', subject: 'eventSubject', copies: amount }, readies: { action: 'ready', amount }, preScry: amount, addBuff: amount, addPoints: amount }
	assert.equal(custom.isEffect(effect), true)
	for (const consume of [
		(amount: unknown) => ({ flow: { repeat: amount } }),
		(amount: unknown) => ({ triggerRepeat: { key: 'launch', amount } }),
		(copies: unknown) => ({ play: { mode: 'copy', subject: 'eventSubject', copies } }),
		(amount: unknown) => ({ readies: { action: 'ready', amount } }),
		(preScry: unknown) => ({ preScry }),
		(addBuff: unknown) => ({ addBuff }),
		(addPoints: unknown) => ({ addPoints }),
	]) assert.equal(custom.isEffect(consume({ stat: 'strength', card: 'recipient' })), false)
})


test('player turn amounts compose with adjustments, predicates, counts and cost multipliers', () => {
	for (const stat of cardEffectVocabulary.PLAYER_TURN_STATS) {
		const amount = { playerStat: { stat, player: { controllerOf: 'recipient' }, window: 'turn' } }
		assert.equal(validators.isEffect({ addPoints: amount, addBuff: amount, draw: amount, readies: { action: 'ready', amount }, costs: { costs: [{ type: 'mana', amount: 2, multiplier: { calculation: { operation: 'multiply', left: amount, right: 2 } } }] }, requirements: { cards: { count: amount, min: 0 } } }), true)
		assert.equal(validators.isConditional({ type: 'amount', amount, max: 0, not: true, unlessPaidAdditionalCost: true, eventPhase: 'beginning' }), true)
	}
	for (const playerStat of [{ stat: 'drawn', player: 'self' }, { stat: 'points', player: 'self', window: 'turn' }, { stat: 'drawn', player: 'self', window: 'game' }, { stat: 'drawn', window: 'turn' }, { stat: 'drawn', player: 'missing', window: 'turn' }]) assert.equal(validators.amount({ playerStat }), false)
	assert.equal(validators.amount({ playerStat: { stat: 'points', player: 'self' } }), true)
})

test('games configure current and turn player stats independently, including shared names', () => {
	const vocabulary = { ...emptyVocabulary, PLAYER_STATS: ['charge'], PLAYER_TURN_STATS: ['charge', 'fuelUsed'] } as const
	const custom = createCardEffectValidators(vocabulary)
	const current: import('../src/cardEffectTypes.ts').AmountExpression<typeof vocabulary> = { playerStat: { stat: 'charge', player: { ownerOf: 'recipient' } } }
	const turn: import('../src/cardEffectTypes.ts').AmountExpression<typeof vocabulary> = { playerStat: { stat: 'fuelUsed', player: { controllerOf: 'recipient' }, window: 'turn' } }
	assert.equal(custom.amount(current), true)
	assert.equal(custom.amount(turn), true)
	assert.equal(custom.amount({ playerStat: { stat: 'charge', player: 'recipient', window: 'turn' } }), false)
	assert.equal(custom.amount({ playerStat: { stat: 'charge', player: { ownerOf: 'recipient' }, window: 'turn' } }), true)
	assert.equal(custom.amount({ playerStat: { stat: 'fuelUsed', player: { ownerOf: 'recipient' } } }), false)
	assert.equal(custom.amount({ playerStat: { stat: 'drawn', player: { ownerOf: 'recipient' }, window: 'turn' } }), false)
})


test('filtered event histories compose with existing amount consumers and recorded metadata', () => {
	const query = { player: { controllerOf: 'recipient' }, role: 'actor', relation: 'team', phase: 'beginning', stage: 'initiated', subject: { cardTypes: [['unit', 'elite'], ['custom-tag', 'elite']], excludeCardTypes: ['token'], exclude: ['recipient', { from: 'previousSelection', index: 0 }], typesFrom: 'current', isAtSite: false }, paidCosts: { costs: [{ type: 'mana', amount: { stat: 'strength', card: { from: 'costSelection', cost: 'revealSelect', index: 0 }, previous: true } }, { type: 'manaRecycle', amount: 2 }] } }
	const amount = { count: { event: 'played', query, window: 'turn' } }
	assert.equal(validators.isEffect({ draw: amount, addPoints: amount, readies: { action: 'ready', amount }, damage: { amount }, modifiers: [{ type: 'strength', amount }], costs: { costs: [{ type: 'mana', amount: 1, multiplier: amount }] } }), true)
	assert.equal(validators.isConditional({ type: 'amount', amount, compare: [{ operator: '>=', value: 2 }], unlessPaidAdditionalCost: true, not: true }), true)
	assert.equal(validators.amount({ count: { event: 'killed', window: 'turn', query: { player: { ownerOf: 'recipient' }, role: 'subjectController', relation: 'opponent', subject: { cardTypes: ['unit'] }, phase: 'ending' } } }), true)
	assert.equal(validators.amount({ count: { query: { players: 'self', source: { area: 'discard' } }, distinctTypes: ['unit'] } }), true)
	assert.equal(validators.amount({ count: { event: 'damaged', card: 'recipient', role: 'subject', window: 'turn', currentObject: true } }), true)
})

test('event query validation keeps occurrence selectors and metadata filters structurally distinct', () => {
	const base = { event: 'played', window: 'turn', query: { player: 'self', role: 'actor' } }
	for (const query of [
		{ player: null }, { role: null }, { player: 'missing' }, { player: 'self', role: 'source' },
		{ ...base.query, phase: 'missing' }, { ...base.query, relation: 'missing' }, { ...base.query, stage: 'unknown' },
		{ ...base.query, subject: { cardTypes: [1] } }, { ...base.query, subject: { typesFrom: 'missing' } },
		{ ...base.query, subject: { exclude: 'missing' } }, { ...base.query, subject: { source: { area: 'discard' } } },
		{ ...base.query, paidCosts: { costs: [{ type: 'missing', amount: 1 }] } },
	]) assert.equal(validators.amount({ count: { ...base, query } }), false)
	for (const count of [{ ...base, card: 'recipient' }, { ...base, currentObject: true }, { ...base, role: 'subject' }, { ...base, event: 'missing' }, { ...base, window: 'game' }]) assert.equal(validators.amount({ count }), false)
	const result = validators.validateEffect({ draw: { count: { ...base, query: { ...base.query, subject: { isAtSite: 'yes' } } } } })
	assert.equal(result.ok, false)
	if (!result.ok) assert.equal(result.issues[0]?.path, 'draw.count.query.subject.isAtSite')
})

test('history vocabularies support recorded occurrences without corresponding trigger keys', () => {
	const vocabulary = { ...emptyVocabulary, HISTORY_EVENTS: ['launch', 'repair'], TURN_STEPS: ['dawn'], PLAYER_TARGETS: ['crew'], COST_TYPES: ['fuel'] } as const
	const custom = createCardEffectValidators(vocabulary)
	const amount: import('../src/cardEffectTypes.ts').AmountExpression<typeof vocabulary> = { count: { event: 'launch', window: 'turn', query: { player: { controllerOf: 'recipient' }, relation: 'crew', role: 'actor', phase: 'dawn', paidCosts: { costs: [{ type: 'fuel', amount: 2 }] } } } }
	assert.equal(custom.amount(amount), true)
	assert.equal(custom.isDefinition({ effect: { draw: amount } }), true)
	assert.equal(custom.isCardEffect({ effects: { launch: [{ effect: { draw: 1 } }] } }), false)
	assert.equal(custom.amount({ count: { event: 'repair', window: 'turn', card: 'recipient', role: 'subject' } }), true)
	assert.equal(custom.amount({ count: { event: 'played', window: 'turn', card: 'recipient', role: 'subject' } }), false)
})


test('games configure relation names and retain nested query and count requirements', () => {
	const vocabulary = { ...emptyVocabulary, CARD_RELATION_TYPES: ['dockedWith', 'escortedBy'], CARD_STATS: ['armor'], CONDITIONAL_TYPES: ['amount'] } as const
	const custom = createCardEffectValidators(vocabulary)
	const query: import('../src/cardEffectTypes.ts').CardSetQuery<typeof vocabulary> = {
		relations: {
			dockedWith: { query: { source: { cards: 'recipient' }, relations: { escortedBy: { min: 2, count: { count: { query: { names: ['Escort'] } } } } } } },
			escortedBy: [{ min: 1, query: { conditional: [{ type: 'amount', amount: { stat: 'armor', card: 'recipient' }, min: 3 }] } }, { max: 0, query: { names: ['Scout'] } }],
		},
	}
	assert.equal(custom.isQuery(query), true)
	assert.equal(custom.isEffect({ select: { query }, draw: { count: { query } } }), true)
	assert.equal(validators.isQuery(query), false)
	assert.equal(custom.isQuery({ relations: { attachedTo: { query: {} } } }), false)
	assert.equal(createCardEffectValidators(emptyVocabulary).isQuery({ relations: { dockedWith: { query: {} } } }), false)
	assert.equal(custom.isQuery({ relations: { dockedWith: { query: { conditional: [{ type: 'amount', amount: { stat: 'strength', card: 'recipient' } }] } } } }), false)
	const result = custom.validateEffect({ select: { query: { relations: { escortedBy: [{ min: 2, max: 1, query: {} }] } } } })
	assert.deepEqual(result, { ok: false, issues: [{ path: 'select.query.relations.escortedBy[0]', expected: 'min <= max' }] })
})

test('default relations share the same vocabulary in types and validation', () => {
	for (const relation of cardEffectVocabulary.CARD_RELATION_TYPES) {
		const name: import('../src/cardEffectTypes.ts').CardRelationType = relation
		assert.equal(validators.isQuery({ relations: { [name]: [{ query: { source: { cards: 'affectingCard' } } }, { min: 0, max: 0, query: { names: ['Other'] } }] } }), true)
	}
})


test('history queries allow independent player and actor defaults while retaining explicit attribution', () => {
	const vocabulary = { ...emptyVocabulary, HISTORY_EVENTS: ['launch'] } as const
	const custom = createCardEffectValidators(vocabulary)
	const amount: import('../src/cardEffectTypes.ts').AmountExpression<typeof vocabulary> = { count: { event: 'launch', window: 'turn', query: { stage: 'initiated', subject: { exclude: 'recipient' } } } }
	assert.equal(custom.amount(amount), true)
	for (const query of [{}, { role: 'actor' }, { role: 'subjectController' }, { player: { ownerOf: 'eventSubject' } }, { player: { controllerOf: 'recipient' }, role: 'subjectController' }]) {
		assert.equal(custom.amount({ count: { event: 'launch', window: 'turn', query } }), true)
	}
	assert.equal(custom.amount({ count: { event: 'launch', window: 'turn', query: { player: 'self' } } }), false)
	assert.equal(custom.amount({ count: { event: 'launch', window: 'turn' } }), false)
})


test('compact event-count conditions reuse recorded metadata and all ordinary numeric gates', () => {
    const conditional: import('../src/cardEffectTypes.ts').CardConditional = {
        type: 'eventCount', event: 'played', stage: 'initiated', exclude: 'recipient',
        player: { ownerOf: 'eventSubject' }, role: 'subjectController', relation: 'opponent', phase: 'beginning',
        cardTypes: [['spell', 'unit'], ['custom-tag', 'unit']], excludeCardTypes: ['token'], typesFrom: 'current', isAtSite: false,
        paidCosts: { costs: [{ type: 'mana', amount: { stat: 'strength', card: { from: 'costSelection', cost: 'revealSelect', index: 0 } } }] },
        min: 0, max: { playerStat: { stat: 'points', player: 'self' } }, compare: [{ operator: '!=', value: 2 }],
        not: true, unlessPaidAdditionalCost: true, eventPhase: 'ending',
    }
    assert.equal(validators.isConditional(conditional), true)
    assert.equal(validators.isCardEffect({ playModifiers: [{ type: 'strength', amount: 2, conditional: [conditional] }], effects: { played: [{ conditionalsSource: [conditional], conditionalsTarget: [conditional], effect: { select: { query: { conditional: [conditional] } }, draw: 1 } }] } }), true)
    for (const event of cardEffectVocabulary.HISTORY_EVENTS) assert.equal(validators.isConditional({ type: 'eventCount', event }), true)
    assert.equal(validators.isConditional({ type: 'eventCount', event: 'killed', role: 'subjectController', relation: 'team', cardTypes: ['unit'], phase: 'beginning', window: 'turn', max: 0 }), true)
})

test('compact history filters stay strict and keep recorded phases separate from card phases', () => {
    const base = { type: 'eventCount', event: 'played' }
    for (const fields of [
        { event: undefined }, { event: 'missing' }, { window: 'game' }, { amount: 1 }, { query: {} }, { subject: {} },
        { player: 'missing' }, { role: 'subject' }, { relation: 'missing' }, { phase: 'missing' }, { stage: 'completed' },
        { cardTypes: [1] }, { exclude: 'missing' }, { typesFrom: 'missing' }, { isAtSite: 'yes' },
        { paidCosts: { costs: [{ type: 'missing', amount: 1 }] } }, { min: 'many' }, { compare: { operator: '~', value: 1 } },
        { source: { area: 'discard' } }, { card: 'recipient' }, { currentObject: true },
    ]) assert.equal(validators.isConditional({ ...base, ...fields }), false)
    assert.equal(validators.isConditional({ type: 'tapped', event: 'played' }), false)
    assert.equal(validators.isConditional({ type: 'amount', amount: 1, exclude: 'recipient' }), false)
    const result = validators.validateEffect({ modifiers: [{ type: 'strength', conditional: [{ ...base, paidCosts: { costs: [{ type: 'mana', amount: 'bad' }] } }] }] })
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.issues[0]?.path, 'modifiers[0].conditional[0].paidCosts.costs[0].amount')
})

test('games opt into compact history conditions and configure their event names independently', () => {
    const vocabulary = { ...emptyVocabulary, CONDITIONAL_TYPES: ['eventCount'], HISTORY_EVENTS: ['launch'], PLAYER_TARGETS: ['crew'], TURN_STEPS: ['dawn'] } as const
    const custom = createCardEffectValidators(vocabulary)
    const condition: import('../src/cardEffectTypes.ts').CardConditional<typeof vocabulary> = { type: 'eventCount', event: 'launch', relation: 'crew', phase: 'dawn', exclude: 'recipient', min: 2 }
    assert.equal(custom.isConditional(condition), true)
    assert.equal(custom.isConditional({ type: 'eventCount', event: 'played' }), false)
    assert.equal(custom.isConditional({ type: 'eventCount', event: 'launch', relation: 'self' }), false)
    assert.equal(createCardEffectValidators({ ...vocabulary, CONDITIONAL_TYPES: [] }).isConditional(condition), false)
})


test('condition groups compose recursively in definitions, modifiers and nested queries', () => {
	const condition = { type: 'all', not: true, eventPhase: 'beginning', conditional: [
		{ type: 'amount', amount: { stat: 'buff', card: 'recipient' } },
		{ type: 'any', unlessPaidAdditionalCost: true, conditional: [
			{ type: 'eventCount', event: 'played', stage: 'initiated', exclude: 'recipient' },
			{ type: 'amount', amount: { count: { query: { cardTypes: ['unit'], source: { area: 'inPlay' } }, card: 'recipient' } }, min: 1 },
		] },
	] }
	assert.equal(validators.isConditional(condition), true)
	assert.equal(validators.isDefinition({ conditionalsSource: [condition], conditionalsTarget: [condition], effect: { modifiers: [{ type: 'strength', conditional: [condition] }], requirements: { cards: { query: { conditional: [condition] } } } } }), true)
	for (const type of ['all', 'any']) assert.equal(validators.isConditional({ type, conditional: [] }), true)
})

test('condition groups enforce their own shape and report nested leaf errors', () => {
	const group = { type: 'all', conditional: [{ type: 'any', conditional: [{ type: 'eventCount', event: 'played' }] }] }
	for (const field of ['min', 'max', 'compare', 'amount', 'event', 'subject', 'query']) assert.equal(validators.isConditional({ ...group, [field]: 1 }), false)
	for (const value of [{ type: 'all' }, { type: 'any', conditional: null }, { type: 'all', conditional: [null] }, { type: 'any', conditional: [{ type: 'unknown' }] }, { type: 'combat', conditional: [] }]) assert.equal(validators.isConditional(value), false)
	const result = validate({ conditionalsSource: [{ type: 'all', conditional: [{ type: 'any', conditional: [{ type: 'eventCount', event: 'missing' }] }] }] }, validators.isDefinition)
	assert.equal(result.ok, false)
	if (!result.ok) assert.equal(result.issues[0]?.path, 'conditionalsSource[0].conditional[0].conditional[0].event')
})

test('games opt into condition groups and independently configure their recursive leaves', () => {
	const vocabulary = { ...emptyVocabulary, CONDITIONAL_TYPES: ['all', 'amount'], CARD_STATS: ['armor'] } as const
	const custom = createCardEffectValidators(vocabulary)
	const group: import('../src/cardEffectTypes.ts').CardConditional<typeof vocabulary> = { type: 'all', conditional: [{ type: 'amount', amount: { stat: 'armor', card: 'recipient' }, min: 2 }] }
	assert.equal(custom.isConditional(group), true)
	assert.equal(custom.isConditional({ type: 'any', conditional: [] }), false)
	assert.equal(custom.isConditional({ type: 'all', conditional: [{ type: 'amount', amount: { stat: 'strength', card: 'recipient' } }] }), false)
	assert.equal(createCardEffectValidators({ ...vocabulary, CONDITIONAL_TYPES: ['amount'] }).isConditional(group), false)
})


test('recursive condition groups reject cycles with the child path and allow shared acyclic children', () => {
	const group: { type: string; conditional: unknown[] } = { type: 'all', conditional: [] }
	group.conditional.push(group)
	assert.equal(validators.isConditional(group), false)
	assert.deepEqual(validate(group, validators.isConditional), { ok: false, issues: [{ path: 'conditional[0]', expected: 'acyclic JSON data' }] })
	const child = { type: 'amount', amount: { stat: 'buff', card: 'recipient' } }
	assert.equal(validators.isConditional({ type: 'all', conditional: [child, child] }), true)
})

test('routing can resolve for the event player', () => {
	const validators = createCardEffectValidators(cardEffectVocabulary)
	assert.equal(validators.isEffect({ addPoints: 1, routing: { resolvingPlayer: 'eventPlayer' } }), true)
	assert.equal(validators.isEffect({ addPoints: 1, routing: { resolvingPlayer: 'turnPlayer' } }), false)
})
