import type { CardTypeFilter } from './cardEffectTypes.ts'

/** Omitted filters accept every card; an empty outer list accepts none. */
export function matchesCardTypes(filter: CardTypeFilter | undefined, hasType: (type: string) => boolean): boolean {
	return filter === undefined || filter.some(term => Array.isArray(term) ? term.every(hasType) : hasType(term))
}

/** Type values mentioned in any alternative, for labels and candidate discovery. */
export function cardTypeValues(filter: CardTypeFilter | undefined): string[] {
	return [...new Set(filter?.flatMap(term => term) ?? [])]
}

/** Every possible alternative must require the type to guarantee it. */
export function requiresCardType(filter: CardTypeFilter | undefined, type: string): boolean {
	return !!filter?.length && filter.every(term => Array.isArray(term) ? term.includes(type) : term === type)
}

/** Remove duplicate requirements and alternatives subsumed by a broader branch. */
export function normalizeCardTypes(filter: CardTypeFilter): CardTypeFilter {
	const groups = filter.map(term => [...new Set(Array.isArray(term) ? term : [term])])
	return groups.filter((group, index) => !groups.some((other, otherIndex) =>
		otherIndex !== index && other.every(type => group.includes(type)) && (other.length < group.length || otherIndex < index),
	)).map(group => group.length === 1 ? group[0]! : group)
}

/** Distribute intersections across OR alternatives, preserving each branch's traits. */
export function intersectCardTypes(left: CardTypeFilter | undefined, right: CardTypeFilter | undefined): CardTypeFilter | undefined {
	if (left === undefined) return right === undefined ? undefined : normalizeCardTypes(right)
	if (right === undefined) return normalizeCardTypes(left)
	return normalizeCardTypes(left.flatMap(a => right.map(b => [...(Array.isArray(a) ? a : [a]), ...(Array.isArray(b) ? b : [b])])))
}
