import type { InPlayLocation, SiteLocation } from './cardEffectTypes.ts'

export function isSiteLocation(value: unknown): value is SiteLocation {
	if (typeof value !== 'string' || !value.startsWith('site-')) return false
	const index = Number(value.slice(5))
	return Number.isSafeInteger(index) && index > 0 && value === `site-${index}`
}

export function isInPlayLocation(value: unknown): value is InPlayLocation {
	return value === 'mainCards' || isSiteLocation(value)
}
