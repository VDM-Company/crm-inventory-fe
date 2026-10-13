import type { PricePlan } from '#shared/types'
import { vertexPricePlanQuerySchema } from '#shared/schemas'

/** Every plan for one scope — active, scheduled and superseded. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const query = await getValidatedQuery(event, vertexPricePlanQuerySchema.parse)
  const data = await vertex().one<PricePlan[]>(`/admin/products/${id}/price-plans`, { query })
  return { data: data ?? [] }
})
