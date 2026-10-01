import type { StoredProduct } from '~/types'

// Pure helpers over an already-loaded product list.
//
// Fetching moved to `useApiProducts()`; what is left here runs inside computeds
// and needs no Nuxt runtime, which is why it is covered by the fast `unit`
// tests rather than the `nuxt` ones.

export function productById(list: StoredProduct[], id: string): StoredProduct | null {
  return list.find(p => p.id === id) || null
}

/** Lowercased SKUs, for the Create form's duplicate check. */
export function productSkus(list: StoredProduct[]): string[] {
  return list.map(p => String(p.sku || '').trim().toLowerCase()).filter(Boolean)
}
