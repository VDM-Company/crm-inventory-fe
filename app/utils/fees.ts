import type { StoredProduct } from '~/types'

// Pure helpers over an already-loaded fee list; `useApiFees()` does the I/O
// and keeps the "Base Price" guard.

// Deterministic seed — exported so callers can initialise refs with the exact
// same value on server and client (avoids a hydration mismatch when the
// Pricing card pre-selects fee components before `onMounted` reads storage).
export { FEE_SEED, FEE_BASE_ID } from '#shared/seeds'

export function feeById(list: Fee[], id: string): Fee | null {
  return list.find(f => f.id === id) || null
}

// How many stored products reference this fee component (delete-protection).
// Mirrors the design's usageCount: checks `pricing.components` (undefined for
// our array-shaped `pricing`, so this is effectively 0 in practice) then a
// legacy top-level `initialComponents`.
// How many products reference this fee (delete-protection).
// Pure: pass a list loaded with `useApiProducts().list()` so it can drive a computed.
export function feeUsageCount(products: StoredProduct[], id: string): number {
  return products.filter(p => (p.pricing || []).some(v => (v?.components || []).some(c => c?.feeId === id))).length
}
