import type { ApiList, Platform, StoredProduct } from '~/types'

// Sales platforms, served by `server/api`.
//
// Reads are async now and can throw — call them from an async `onMounted`
// (or an event handler) and handle the failure there. Writes go through
// `apiCreate` / `apiUpdate` / `apiRemove` at the call site, because the API is
// per-record while this module used to replace the whole list at once.

// re-exported so the existing auto-imported call sites keep working
export { PLATFORM_SEED } from '#shared/seeds'

function clone(p: Platform): Platform {
  return { id: p.id, name: p.name, code: p.code, url: p.url }
}

export async function loadPlatforms(): Promise<Platform[]> {
  const res = await $fetch<ApiList<Platform>>('/api/platforms')
  return (res.data || []).map(clone)
}

export function platformById(list: Platform[], id: string): Platform | null {
  return list.find(p => p.id === id) || null
}

// Lowercase identifier from a display name (design's VertexPlatform.slug).
export function platformSlug(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// How many products are assigned to this platform (delete-protection).
// Pure: pass a list loaded with `loadProducts()` so it can drive a computed.
export function platformAssignedCount(products: StoredProduct[], platformId: string): number {
  return products.filter(p => Array.isArray(p.platformIds) && p.platformIds.indexOf(platformId) !== -1).length
}
