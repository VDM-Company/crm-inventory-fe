import type { ProductContent } from '#shared/types'

/**
 * The Default content and, per platform, which fields that platform
 * overrides. A platform that no longer sells the product but still overrides
 * a field is listed with `assigned: false`.
 */
export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  return vertex().one<ProductContent>(`/admin/products/${id}/platform-content`)
})
