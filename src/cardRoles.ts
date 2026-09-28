import type { CardData, CardRoles, ConfigGameMode, ConfigGameRules } from './cardEffectTypes.ts'
import { array, invalid, property, record, strings, validate } from './primitives.ts'

export function hasCardRole(types: readonly string[], roles: CardRoles | undefined, role: keyof CardRoles): boolean {
	const type = roles?.[role]
	return type !== undefined && types.includes(type)
}

export function leaderCountForMode(roles: CardRoles | undefined, mode: ConfigGameMode | undefined): number {
	return mode?.leaders ?? (roles?.leader ? 1 : 0)
}

export function chosenCountForMode(roles: CardRoles | undefined, mode: ConfigGameMode | undefined): number {
	return mode?.chosens ?? (leaderCountForMode(roles, mode) > 0 ? 1 : 0)
}

export function isResourceDeckCard(card: Pick<CardData, 'types'>, roles: CardRoles | undefined): boolean {
	return hasCardRole(card.types, roles, 'resource')
}

export function isMainDeckCard(card: Pick<CardData, 'types'>, roles: CardRoles | undefined): boolean {
	return !hasCardRole(card.types, roles, 'leader') && !hasCardRole(card.types, roles, 'site') && !isResourceDeckCard(card, roles)
}

type ClassifiedGame = { cardRoles?: CardRoles; rules?: ConfigGameRules; cards: readonly Pick<CardData, 'types'>[] }

export function isOpeningCard(card: Pick<CardData, 'types' | 'upgrade'>, types: readonly string[]): boolean {
	return !card.upgrade && card.types.some(type => types.includes(type))
}

/** Call after structural validation; classification is defined by game card roles. */
export function cardClassificationsMatch(game: ClassifiedGame): boolean {
	return property(game, 'cards', array(card => record(card) && property(card, 'types', types => {
		if (!strings(types)) return false
		const roles = [hasCardRole(types, game.cardRoles, 'leader'), hasCardRole(types, game.cardRoles, 'site'), isResourceDeckCard({ types }, game.cardRoles)]
		return roles.filter(Boolean).length <= 1 || invalid('at most one deck role: leader, site, or resource')
	})))
}

export function validateCardClassifications(game: ClassifiedGame) {
	return validate(game, () => cardClassificationsMatch(game))
}
