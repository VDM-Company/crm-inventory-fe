import type { VertexProduct } from '#shared/types'
import { vertexProductStatusSchema } from '#shared/schemas'

/**
 * The only way a status moves: draft → active|inactive, and active ↔ inactive.
 * Activation checks the product is complete — 422 `base_price_required`,
 * `no_active_variant`, or `bundle_incomplete`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const body = await parseBody(event, vertexProductStatusSchema)
  return vertex().one<VertexProduct>(`/admin/products/${id}/status`, { method: 'POST', body })
})
