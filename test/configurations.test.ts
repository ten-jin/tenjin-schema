import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createConfigurationValidators, validateGameModeRules, configurationSourceUrl } from '../src/configurations.ts'
import { cardEffectVocabulary } from '../src/cardEffectVocabulary.ts'

const validators = createConfigurationValidators(cardEffectVocabulary)
const card = { id: 'one', name: 'One', image: '', description: '', strength: 0, manaTap: 0, manaRecycle: 0, colors: [], types: [] }
const mode = { gameName: 'Example', name: 'Standard', version: '1', players: 2, points: 0, mainDeck: { minimumSize: 0, maximumSize: 10 } }
const game = { name: 'Example', version: '1', sets: {}, colors: { mainDeck: 'gray', manaDeck: 'blue' }, cardRoles: { leader: 'leader', site: 'site' }, terminology: {}, cards: [card], defaultMode: mode }

test('games may omit either or both card roles', () => {
	const { cardRoles: _roles, ...withoutRoles } = game
	assert.equal(validators.isGameConfiguration(withoutRoles), true)
	for (const cardRoles of [{}, { leader: 'leader' }, { site: 'site' }, { resource: 'energy' }]) {
		assert.equal(validators.isGameConfiguration({ ...withoutRoles, cardRoles }), true)
	}
	assert.equal(validators.isGameConfiguration({ ...withoutRoles, cardRoles: { leader: '' } }), false)
	assert.equal(validators.isGameConfiguration({ ...withoutRoles, cardRoles: { site: '' } }), false)
})

test('unique site choices require at least one deck site', () => {
	assert.equal(validators.isModeConfiguration({ ...mode, sites: { minimumSize: 0, choose: 'unique' } }), false)
	assert.equal(validators.isModeConfiguration({ ...mode, sites: { minimumSize: 1, choose: 'unique' } }), true)
	assert.equal(validators.isModeConfiguration({ ...mode, sites: { minimumSize: 0 } }), true)
	assert.equal(validators.isModeConfiguration({ ...mode, sites: { minimumSize: 0, perPlayer: true } }), false)
})

test('opening-card rules validate against the selected mode', () => {
	const selectedMode = { ...mode, mainDeck: { ...mode.mainDeck, setupDraw: [1,1] }, sites: { minimumSize: 0 } }
	const rules = { openingCardTypes: ['unit'] }
	const opening = { ...game, rules, defaultMode: selectedMode }
	assert.equal(validators.isGameConfiguration(opening), true)
	for (const mainDeck of [{ ...mode.mainDeck }, { ...mode.mainDeck, setupDraw: [1] }, { ...mode.mainDeck, setupDraw: [1,0] }, { ...mode.mainDeck, setupDraw: [1,1], handLimit: 0 }]) {
		assert.equal(validators.isGameConfiguration({ ...opening, defaultMode: { ...selectedMode, mainDeck } }), false)
	}
	for (const rule of [{ openingCardTypes: [] }, { ...rules, siteUnitLimit: 0 }]) assert.equal(validators.isGameConfiguration({ ...opening, rules: rule }), false)
	assert.equal(validators.isGameConfiguration({ ...opening, defaultMode: mode }), false)
	assert.equal(validateGameModeRules(opening, { ...selectedMode, players: 3 }).ok, false)
	assert.equal(validateGameModeRules(opening, selectedMode).ok, true)
})

test('mode decks combine construction and draw rules', () => {
	assert.equal(validators.isModeConfiguration({ ...mode, mainDeck: { ...mode.mainDeck, copyLimit: 0, setupDraw: [1,1], turnDraw: 0, setupMulligan: 0, handLimit: 0 }, manaDeck: { minimumSize: 0, turnDraw: 1 }, colorLimit: 0 }), true)
	assert.equal(validators.isGameConfiguration({ ...game, rules: { mainUnitLimit: 0, siteUnitLimit: 0, disableEndTurn: false, defeatedUnitPoints: 1, leaderColorIdentity: false } }), true)
	for (const field of ['mainDeck','manaDeck']) assert.equal(validators.isGameConfiguration({ ...game, rules: { [field]: {} } }), false)
	for (const mainDeck of [{ cardTypes: ['unit'] }, { turnDraw: -1 }, { setupDraw: [1.5] }]) assert.equal(validators.isModeConfiguration({ ...mode, mainDeck: { ...mode.mainDeck, ...mainDeck } }), false)
	for (const field of ['handLimit','copyLimit','setupMulligan','cardTypes']) assert.equal(validators.isModeConfiguration({ ...mode, manaDeck: { minimumSize: 0, [field]: 0 } }), false)
	for (const field of ['leaderColorIdentity','signatureLimit','openingCard','openingCardTypes','baseUnitLimit','mainUnitLimit','manualEndTurn','disableEndTurn','defeatedUnitPoints','requiredInPlay','upgradeDelayTurns','emptyDeckDraw']) assert.equal(validators.isModeConfiguration({ ...mode, [field]: 0 }), false)
	for (const colorLimit of [-1,1.5]) assert.equal(validators.isModeConfiguration({ ...mode, colorLimit }), false)
})

test('resource classifications use game roles independently of modes', () => {
	const selectedMode = { ...mode, manaDeck: { minimumSize: 0 } }
	for (const types of [['leader','site'],['leader','rune'],['site','rune']]) {
		const config = { ...game, cardRoles: { ...game.cardRoles, resource: 'rune' }, defaultMode: selectedMode, cards: [{ ...card, types }] }
		const result = validators.validateGameConfiguration(config)
		assert.deepEqual(result, { ok: false, issues: [{ path: 'cards[0].types', expected: 'at most one deck role: leader, site, or resource' }] })
		assert.equal(validateGameModeRules(config, selectedMode).ok, false)
	}
})

test('card roles require single type names and cannot be duplicated in terminology', () => {
	assert.equal(validators.isGameConfiguration({ ...game, cardRoles: { leader: 'commander', site: 'arena' } }), true)
	for (const cardRoles of [{ leader: '', site: 'arena' }, { leader: ['commander'], site: 'arena' }, { leader: 'commander', site: ['arena'] }]) {
		assert.equal(validators.isGameConfiguration({ ...game, cardRoles }), false)
	}
	for (const role of ['leader', 'site', 'resource']) {
		const result = validators.validateGameConfiguration({ ...game, terminology: { [role]: role } })
		assert.deepEqual(result, { ok: false, issues: [{ path: `terminology.${role}`, expected: 'role label defined only in cardRoles' }] })
	}
})

test('variant IDs may repeat for their owner but never resolve to different cards', () => {
	const first = { ...card, variants: { alternate: 'one.png', one: 'same.png' } }
	assert.equal(validators.isGameConfiguration({ ...game, cards: [first] }), true)
	for (const cards of [[first, { ...card, id: 'two', variants: { alternate: 'two.png' } }], [{ ...card, variants: { two: 'one.png' } }, { ...card, id: 'two' }], [{ ...card, id: 'two' }, { ...card, variants: { two: 'one.png' } }]]) {
		const result = validators.validateGameConfiguration({ ...game, cards })
		assert.equal(result.ok, false)
		if (!result.ok) assert.match(result.issues[0]!.path, /^cards\[\d+\]\.variants\./)
	}
	const aliases = createConfigurationValidators(cardEffectVocabulary, { variantAliases: id => [id.split(':')[0]!] })
	assert.equal(aliases.isGameConfiguration({ ...game, cards: [{ ...card, variants: { 'one:alt': 'one.png' } }] }), true)
	assert.equal(aliases.isGameConfiguration({ ...game, cards: [{ ...card, variants: { 'two:alt': 'one.png' } }, { ...card, id: 'two' }] }), false)
})

test('release and ban maps require real calendar dates with field diagnostics', () => {
	for (const value of ['2024-02-29', '2000-02-29', '2026-09-27']) {
		assert.equal(validators.isGameConfiguration({ ...game, sets: { TEST: value }, banned: { One: value } }), true)
		assert.equal(validators.isModeConfiguration({ ...mode, sets: { TEST: value }, banned: { One: value } }), true)
	}
	for (const value of ['', 'tomorrow', '2026-2-01', '2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-01-00', '2026-01-01T00:00:00Z']) {
		for (const field of ['sets', 'banned'] as const) {
			for (const result of [validators.validateGameConfiguration({ ...game, [field]: { TEST: value } }), validators.validateModeConfiguration({ ...mode, [field]: { TEST: value } })]) {
				assert.deepEqual(result, { ok: false, issues: [{ path: `${field}.TEST`, expected: 'valid YYYY-MM-DD date' }] })
			}
		}
	}
})

test('complete configurations accept explicit zeros and embedded defaults', () => {
	assert.equal(validators.isGameConfiguration(game), true)
	assert.equal(validators.isModeConfiguration(mode), true)
	assert.equal(validators.isDeckConfiguration({ name: 'Empty', gameName: 'Example', cards: '' }), true)
	assert.deepEqual(validators.validateGameConfiguration(game), { ok: true })
})
test('configuration errors name the failing field', () => {
	for (const [value, path] of [[{ ...game, version: undefined }, 'version'], [{ ...game, cards: [] }, 'cards'], [{ ...game, cards: [card, card] }, 'cards[1].id'], [{ ...game, colors: {} }, 'colors.mainDeck'], [{ ...game, defaultMode: { ...mode, gameName: 'Other' } }, 'defaultMode.gameName']] as const) {
		const result = validators.validateGameConfiguration(value)
		assert.equal(result.ok, false)
		if (!result.ok) assert.equal(result.issues[0]?.path, path)
	}
})
test('mode semantics reject impossible bounds and counts', () => {
	for (const leaders of [0, 1]) assert.equal(validators.isModeConfiguration({ ...mode, leaders }), true)
	assert.deepEqual(validators.validateModeConfiguration({ ...mode, leaders: 2 }), { ok: false, issues: [{ path: 'leaders', expected: '0 or 1' }] })
	for (const value of [{ ...mode, players: 0 }, { ...mode, players: 2.5 }, { ...mode, teamSize: 3 }, { ...mode, mainDeck: { minimumSize: 10, maximumSize: 2, turnDraw: 1 } }, { ...mode, manaDeck: { minimumSize: 0, turnDraw: -1 } }, { ...mode, sites: { minimumSize: 2, maximumSize: 1 } }, { ...mode, sideboard: { minimumSize: -1 } }, { ...mode, mainDeck: { minimumSize: 0, setupDraw: [1.5] } }]) assert.equal(validators.isModeConfiguration(value), false)
	assert.equal(validators.isModeConfiguration(mode, 'Other'), false)
	assert.equal(validators.isModeConfiguration(mode, 'Example'), true)
})

test('definition sources are optional safe web URLs, readable independently of the contract', () => {
	const deck = { gameName: 'Example', name: 'Deck', cards: '' }
	for (const [config, check] of [[game, validators.isGameConfiguration], [mode, validators.isModeConfiguration], [deck, validators.isDeckConfiguration]] as const) {
		assert.equal(check({ ...config, sourceUrl: 'https://example.com/definitions' }), true)
		for (const sourceUrl of ['', '/relative', 'javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.com', 42]) assert.equal(check({ ...config, sourceUrl }), false)
	}
	assert.equal(configurationSourceUrl({ obsolete: true, sourceUrl: 'https://example.com/update' }), 'https://example.com/update')
	assert.equal(configurationSourceUrl(null), undefined)
})
