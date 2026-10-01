import type { ApiList, StoredProduct } from '~/types'

// Products, served by `server/api`.
//
// `loadProducts()` is the single read; the counters below are pure so they can
// be used inside computeds over an already-loaded list.

export async function loadProducts(): Promise<StoredProduct[]> {
  const res = await $fetch<ApiList<StoredProduct>>('/api/products')
  return res.data || []
}

export async function loadProduct(id: string): Promise<StoredProduct> {
  return $fetch<StoredProduct>(`/api/products/${id}`)
}

export function productById(list: StoredProduct[], id: string): StoredProduct | null {
  return list.find(p => p.id === id) || null
}

/** Lowercased SKUs, for the Create form's duplicate check. */
export function productSkus(list: StoredProduct[]): string[] {
  return list.map(p => String(p.sku || '').trim().toLowerCase()).filter(Boolean)
}
