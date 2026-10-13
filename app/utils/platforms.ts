import type { Platform, StoredProduct } from '~/types'

// Pure helpers over an already-loaded platform list. Reads and writes go
// through `useApiPlatforms()`.

// re-exported so the existing auto-imported call sites keep working
export { PLATFORM_SEED } from '#shared/seeds'

export function platformById(list: Platform[], id: string): Platform | null {
  return list.find(p => p.id === id) || null
}

// Lowercase identifier from a display name (design's VertexPlatform.slug).
export function platformSlug(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// How many products are assigned to this platform (delete-protection).
// Pure: pass a list loaded with `useApiProducts().list()` so it can drive a computed.
export function platformAssignedCount(products: StoredProduct[], platformId: string): number {
  return products.filter(p => Array.isArray(p.platformIds) && p.platformIds.indexOf(platformId) !== -1).length
}
