import type { Fee } from '~/types'
import { FEE_SEED, FEE_BASE_ID } from '#shared/seeds'

// Port of the design's `window.VertexFees` (fee-store.js).
// Reusable Initial-Fee line-item components persisted in localStorage.
// "Base Price" (fee_base) is a locked system component that always exists.

const KEY = 'vertex_fees_v1'

// Deterministic seed — exported so callers can initialise refs with the exact
// same value on server and client (avoids a hydration mismatch when the
// Pricing card pre-selects fee components before `onMounted` reads storage).
export { FEE_SEED, FEE_BASE_ID } from '#shared/seeds'

function clone(f: Fee): Fee {
  return { id: f.id, name: f.name, icon: f.icon, description: f.description || '', system: !!f.system }
}

export function loadFees(): Fee[] {
  if (import.meta.client) {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (Array.isArray(r) && r.length) {
        const list = r.map(clone)
        // guarantee the Base Price system component always exists and stays locked
        const base = list.find(f => f.id === FEE_BASE_ID)
        if (!base) list.unshift({ id: FEE_BASE_ID, name: 'Base Price', description: 'Core product price', system: true })
        else base.system = true
        return list
      }
    } catch {
      // ignore malformed storage
    }
  }
  return FEE_SEED.map(clone)
}

export function feeById(list: Fee[], id: string): Fee | null {
  return list.find(f => f.id === id) || null
}

export function saveFees(list: Fee[]): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      // ignore storage failure
    }
  }
}

// How many stored products reference this fee component (delete-protection).
// Mirrors the design's usageCount: checks `pricing.components` (undefined for
// our array-shaped `pricing`, so this is effectively 0 in practice) then a
// legacy top-level `initialComponents`.
export function feeUsageCount(id: string): number {
  if (!import.meta.client) return 0
  type Comp = { feeId?: string, id?: string }
  type StoredP = { pricing?: { components?: Comp[] }, initialComponents?: Comp[] }
  try {
    const products = (JSON.parse(localStorage.getItem('vertex_products') || '[]') || []) as StoredP[]
    return products.filter((p) => {
      const comps = (p.pricing && p.pricing.components) || p.initialComponents || []
      return comps.some(c => c.feeId === id || c.id === id)
    }).length
  } catch {
    return 0
  }
}
