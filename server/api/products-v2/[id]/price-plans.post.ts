import type { PricePlan } from '#shared/types'
import { vertexPricePlanCreateSchema } from '#shared/schemas'

/**
 * A new plan. `effectiveAt` null or past takes effect now and supersedes the
 * active one; later schedules it. Exactly one Base Price line is required
 * (422 `base_price_required`).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const body = await parseBody(event, vertexPricePlanCreateSchema)
  const created = await vertex().one<PricePlan>(`/admin/products/${id}/price-plans`, { method: 'POST', body })
  setResponseStatus(event, 201)
  return created
})
