import type { ProductPricing } from '#shared/types'

/**
 * Start pricing this product separately on one platform, by copying the
 * Default plan in force. 422 `default_price_required` without one, 409
 * `already_overridden` if it is already on its own.
 */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  const platform = getRouterParam(event, 'platform')
  if (!id || !platform) throw notFound('product pricing')
  return vertex().one<ProductPricing>(
    `/admin/products/${id}/pricing/platforms/${platform}/override`, { method: 'POST' })
})
