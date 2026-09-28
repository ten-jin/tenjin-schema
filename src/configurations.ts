import type { CardEffectVocabulary } from './cardEffectVocabulary.ts'
import type { ConfigGameCards, ConfigGameRules, ConfigGameDeck, ConfigGameMode, ConfigGameMainDeck, ConfigGameResourceDeck, ConfigGameSideboard, ConfigGameSite, ExportedGameCards } from './cardEffectTypes.ts'
import { createCardEffectValidators } from './cardEffects.ts'
import { cardClassificationsMatch } from './cardRoles.ts'
import { array, boolean, count, invalid, literal, number, object, property, record, required, string, stringRecord, strings, validate } from './primitives.ts'

const name = (value: unknown) => string(value) && (value.trim().length > 0 || invalid('nonempty string'))
/** Read update metadata even when the rest of a definition is no longer valid. */
export function configurationSourceUrl(value: unknown): string | undefined {
	if (!value || typeof value !== 'object' || !('sourceUrl' in value) || typeof value.sourceUrl !== 'string') return undefined
	try {
		const url = new URL(value.sourceUrl)
		return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : undefined
	} catch { return undefined }
}
const sourceUrl = (value: unknown): boolean => configurationSourceUrl({ sourceUrl: value }) !== undefined || invalid('absolute HTTP(S) URL without credentials')
const positiveCount = (value: unknown) => count(value) && (value > 0 || invalid('positive safe integer'))
const date = (value: unknown): boolean => {
	if (!string(value)) return false
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return invalid('valid YYYY-MM-DD date')
	const parsed = new Date(`${value}T00:00:00.000Z`)
	return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value || invalid('valid YYYY-MM-DD date')
}
const dates = stringRecord(date)
const sizeFields = { minimumSize: count, maximumSize: count }
function orderedSize(value: unknown): boolean {
	return record(value) && (value.maximumSize === undefined || property(value, 'maximumSize', maximum => typeof maximum === 'number' && typeof value.minimumSize === 'number' && maximum >= value.minimumSize || invalid('maximumSize >= minimumSize')))
}
const deckDrawFields = { setupDraw: array(count), firstTurnDraw: array(count), turnDraw: count }
const rules = object<ConfigGameRules>({ leaderColorIdentity: boolean, openingCardTypes: value => strings(value) && (value.length > 0 || invalid('nonempty opening-card types')), upgradeDelayTurns: count, mainUnitLimit: count, siteUnitLimit: count, disableEndTurn: boolean, emptyDeckDraw: literal('ignore'), defeatedUnitPoints: count, requiredInPlay: strings })
const mainDeckRules = object<ConfigGameMainDeck>({ ...sizeFields, ...deckDrawFields, copyLimit: count, handLimit: count, setupMulligan: count }, ['minimumSize'])
const resourceDeckRules = object<ConfigGameResourceDeck>({ ...sizeFields, ...deckDrawFields }, ['minimumSize'])
const sideboard = object<ConfigGameSideboard>(sizeFields, ['minimumSize'])
const sites = object<ConfigGameSite>({ ...sizeFields, choose: literal('random', 'unique') }, ['minimumSize'])
const deck = object<ConfigGameDeck>({ sourceUrl, hash: name, name, gameName: name, cards: string, sideboard: string }, ['name', 'gameName', 'cards'])
const mode = object<ConfigGameMode>({ sourceUrl,
	sets: dates, hash: name, gameName: name, name, version: name, players: positiveCount, games: positiveCount, teamSize: positiveCount,
	points: count, leaders: literal(0, 1), chosens: count, colorLimit: count,
	sites: value => sites(value) && orderedSize(value), sideboard: value => sideboard(value) && orderedSize(value), banned: dates,
	mainDeck: value => mainDeckRules(value) && orderedSize(value), manaDeck: value => resourceDeckRules(value) && orderedSize(value),
}, ['gameName', 'name', 'version', 'players', 'points', 'mainDeck'])

function matchingGame(value: unknown, gameName?: string): boolean {
	return gameName === undefined || record(value) && property(value, 'gameName', name => name === gameName || invalid(`gameName ${JSON.stringify(gameName)}`))
}
export function isDeckConfiguration(value: unknown, gameName?: string): value is ConfigGameDeck {
	return deck(value) && matchingGame(value, gameName)
}
export function isModeConfiguration(value: unknown, gameName?: string): value is ConfigGameMode {
	if (!mode(value) || !record(value) || !matchingGame(value, gameName)) return false
	if (value.teamSize !== undefined && !property(value, 'teamSize', size => typeof size === 'number' && typeof value.players === 'number' && value.players % size === 0 || invalid('teamSize dividing players evenly'))) return false
	if (record(value.sites) && value.sites.choose === 'unique' && !property(value, 'sites', sites => record(sites) && property(sites, 'minimumSize', positiveCount))) return false

	return true
}
export function validateModeConfiguration(value: unknown, gameName?: string) { return validate(value, value => isModeConfiguration(value, gameName)) }
export function validateDeckConfiguration(value: unknown, gameName?: string) { return validate(value, value => isDeckConfiguration(value, gameName)) }

/** Validate rules that depend on both the game and selected format. */
function gameModeRulesMatch(game: Parameters<typeof cardClassificationsMatch>[0], mode: ConfigGameMode): boolean {
	if (!game.rules?.openingCardTypes) return true
	return (game.rules.siteUnitLimit !== 0 || property(game, 'rules', value => record(value) && property(value, 'siteUnitLimit', positiveCount)))
	&& property({ ...mode }, 'mainDeck', deck => record(deck)
	 && property(deck, 'setupDraw', draws => Array.isArray(draws) && draws.length >= mode.players && draws.slice(0, mode.players).every(draw => typeof draw === 'number' && draw > 0) || invalid('positive opening draw for every player'))
	 && (deck.handLimit !== 0 || property(deck, 'handLimit', positiveCount)))
	&& property({ ...mode }, 'sites', () => !!game.cardRoles?.site && !!mode.sites || invalid('a site for every opening-card player'))
}
export function validateGameModeRules(game: Parameters<typeof cardClassificationsMatch>[0], mode: ConfigGameMode) {
	return validate(game, () => cardClassificationsMatch(game) && gameModeRulesMatch(game, mode))
}

export function createConfigurationValidators<const V extends CardEffectVocabulary>(vocabulary: V, options: { variantAliases?: (id: string) => readonly string[] } = {}) {
	const cards = createCardEffectValidators(vocabulary)
	const stringMap = stringRecord(string)
	const game = object<ExportedGameCards<V>>({ sourceUrl,
		hash: name, name, version: name, sets: dates, banned: dates,
		cardRoles: object({ leader: name, site: name, resource: name }), rules,
		terminology: value => stringMap(value) && record(value) && ['leader', 'site', 'resource'].every(key => !Object.hasOwn(value, key) || property(value, key, () => invalid('role label defined only in cardRoles'))),
		colors: value => record(value) && required(value, ['mainDeck', 'manaDeck']) && stringMap(value),
		layout: object({ compactCardHeight: string }), defaultMode: isModeConfiguration, defaultDecks: array(isDeckConfiguration),
		cards: value => {
			if (!Array.isArray(value) || value.length === 0) return invalid('nonempty cards array')
			const ids = new Set<string>()
			const owners = new Map<string, unknown>()
			for (const card of value) if (record(card) && typeof card.id === 'string') owners.set(card.id, card)
			return array(card => {
				if (!record(card) || !cards.isExportedCardData(card)) return false
				if (!property(card, 'id', id => {
					if (!name(id) || typeof id !== 'string') return false
					if (ids.has(id)) return invalid('unique card id')
					ids.add(id)
					return true
				})) return false
				return card.variants === undefined || property(card, 'variants', variants => record(variants) && Object.keys(variants).every(id => property(variants, id, () => {
					for (const alias of [id, ...(options.variantAliases?.(id) ?? [])]) {
						if (owners.has(alias) && owners.get(alias) !== card) return invalid('variant id resolving to only one card')
						owners.set(alias, card)
					}
					return true
				})))
			})(value)
		},
	}, ['name', 'version', 'sets', 'colors', 'terminology', 'cards'])
	function isGameConfiguration(value: unknown): value is ExportedGameCards<V> {
		if (!game(value) || !record(value) || typeof value.name !== 'string') return false
		const gameName = value.name
		const config = value as unknown as ExportedGameCards<V>
		return cardClassificationsMatch(config) && (!config.defaultMode || gameModeRulesMatch(config, config.defaultMode))
			&& (value.defaultMode === undefined || property(value, 'defaultMode', mode => matchingGame(mode, gameName)))
			&& (value.defaultDecks === undefined || property(value, 'defaultDecks', array(deck => matchingGame(deck, gameName))))
	}
	return { isGameConfiguration, isModeConfiguration, isDeckConfiguration, validateGameConfiguration: (value: unknown) => validate(value, isGameConfiguration), validateModeConfiguration, validateDeckConfiguration }
}
