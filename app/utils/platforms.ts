import type { Platform } from '~/types'
import { PLATFORM_SEED as SEED } from '#shared/seeds'

// Port of the design's `window.VertexPlatform` (platform-store.js).
// Flat list of sales platforms persisted in localStorage; SSR-safe reads.

const KEY = 'vertex_platforms_v2'

// Deterministic seed — exported so pages can initialise refs with the exact
// same value on server + first client paint (avoids a hydration mismatch /
// empty-state flash before `onMounted` reads storage).
// re-exported so the existing auto-imported call sites keep working
export { PLATFORM_SEED } from '#shared/seeds'

const DEFAULTS = SEED

function clone(p: Platform): Platform {
  return { id: p.id, name: p.name, code: p.code, url: p.url }
}

export function loadPlatforms(): Platform[] {
  if (import.meta.client) {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (Array.isArray(r) && r.length) return r.map(clone)
    } catch {
      // ignore malformed storage
    }
  }
  return DEFAULTS.map(clone)
}

export function savePlatforms(list: Platform[]): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      // ignore storage failure
    }
  }
}

export function platformById(list: Platform[], id: string): Platform | null {
  return list.find(p => p.id === id) || null
}

// Lowercase identifier from a display name (design's VertexPlatform.slug).
export function platformSlug(name: string): string {
  return (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// How many stored products are assigned to this platform (delete-protection).
export function platformAssignedCount(platformId: string): number {
  if (!import.meta.client) return 0
  try {
    const products: { platformIds?: string[] }[] = JSON.parse(localStorage.getItem('vertex_products') || '[]') || []
    return products.filter(p => Array.isArray(p.platformIds) && p.platformIds.indexOf(platformId) !== -1).length
  } catch {
    return 0
  }
}
