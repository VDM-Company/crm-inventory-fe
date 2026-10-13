// Pure helpers over an already-loaded fee list; `useApiFees()` does the I/O
// and keeps the "Base Price" guard.

// Deterministic seed — exported so callers can initialise refs with the exact
// same value on server and client (avoids a hydration mismatch when the
// Pricing card pre-selects fee components before `onMounted` reads storage).
export { FEE_SEED, FEE_BASE_ID, FEE_TAX_ID, FEE_SHIPPING_ID } from '#shared/seeds'

export function feeById(list: Fee[], id: string): Fee | null {
  return list.find(f => f.id === id) || null
}
