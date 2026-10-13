import type { ProductPricing } from '#shared/types'

/**
 * How each scope prices this product: Default, plus every platform that is
 * assigned or still overrides. Sellable products only — a configurable parent
 * is 422 `not_sellable`, because only its variants carry prices.
 */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  return vertex().one<ProductPricing>(`/admin/products/${id}/pricing`)
})
