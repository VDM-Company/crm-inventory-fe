import type { VertexProduct } from '#shared/types'
import { vertexProductDuplicateSchema } from '#shared/schemas'

/**
 * Copies everything into a new Draft. Without `skuPrefix` the API derives
 * `{SKU}-COPY`, `-COPY2`, …; with one it is 422 `sku_taken` if a non-draft
 * product already claims it.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const body = await parseBody(event, vertexProductDuplicateSchema)
  const created = await vertex().one<VertexProduct>(`/admin/products/${id}/duplicate`, { method: 'POST', body })
  setResponseStatus(event, 201)
  return created
})
