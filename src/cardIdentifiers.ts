/** Optional card-profile convention: a final letter or * marks a variant suffix. */
export function variantAlias(id: string): string {
	return id.replace(/[a-zA-Z*]$/, '')
}

/** Opt-in alias policy shared by producers and consumers of suffixed card IDs. */
export const suffixedVariantPolicy = { variantAliases: (id: string) => [variantAlias(id)] }
