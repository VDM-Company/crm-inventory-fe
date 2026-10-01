import type { Fee } from '~/types'
import { FEE_BASE_ID } from '#shared/seeds'

// Reusable Initial-Fee line-item components, served by `server/api`.
// "Base Price" (fee_base) is a locked system component that always exists.

// Deterministic seed — exported so callers can initialise refs with the exact
// same value on server and client (avoids a hydration mismatch when the
// Pricing card pre-selects fee components before `onMounted` reads storage).
export { FEE_SEED, FEE_BASE_ID } from '#shared/seeds'

function clone(f: Fee): Fee {
  return { id: f.id, name: f.name, icon: f.icon, description: f.description || '', system: !!f.system }
}

export async function loadFees(): Promise<Fee[]> {
  const res = await $fetch<ApiList<Fee>>('/api/fees')
  const list = (res.data || []).map(clone)
  // the base fee is structural: every product carries it, so keep the guard
  // the localStorage loader used to apply
  if (!list.some(f => f.id === FEE_BASE_ID)) {
    list.unshift({ id: FEE_BASE_ID, name: 'Base Price', description: 'Core product price', system: true })
  }
  return list
}

export function feeById(list: Fee[], id: string): Fee | null {
  return list.find(f => f.id === id) || null
}

// How many stored products reference this fee component (delete-protection).
// Mirrors the design's usageCount: checks `pricing.components` (undefined for
// our array-shaped `pricing`, so this is effectively 0 in practice) then a
// legacy top-level `initialComponents`.
// How many products reference this fee (delete-protection).
// Pure: pass a list loaded with `loadProducts()` so it can drive a computed.
export function feeUsageCount(products: StoredProduct[], id: string): number {
  return products.filter(p => (p.pricing || []).some(v => (v?.components || []).some(c => c?.feeId === id))).length
}
