import type { VariantPreview } from '#shared/types'
import { vertexVariantAxesSchema } from '#shared/schemas'

/**
 * What generating these axes would do, without doing it: the combinations,
 * each one's suggested SKU and whether that SKU is free, plus which existing
 * variants would be deleted (never ordered) or merely disabled (ordered).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const body = await parseBody(event, vertexVariantAxesSchema)
  return vertex().one<VariantPreview>(`/admin/products/${id}/variants/preview`, { method: 'POST', body })
})
