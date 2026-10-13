import type { ProductPricing } from '#shared/types'

/**
 * Put a platform back on the Default price. The plan in force becomes
 * `superseded` and anything scheduled is `cancelled`; the history stays.
 * A platform already following Default comes back unchanged.
 */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  const platform = getRouterParam(event, 'platform')
  if (!id || !platform) throw notFound('product pricing')
  return vertex().one<ProductPricing>(
    `/admin/products/${id}/pricing/platforms/${platform}/reset`, { method: 'POST' })
})
