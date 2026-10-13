import { vertexCategoryProductsOrderSchema } from '#shared/schemas'

/**
 * Sets the order. `productIds` must be exactly the current members, or the
 * API answers 422 `members_mismatch` — so a caller has to send the list it
 * just read, not a subset.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('category')
  const body = await parseBody(event, vertexCategoryProductsOrderSchema)
  return vertex().one<{ saved: boolean }>(`/admin/categories/${id}/products`, { method: 'PUT', body })
})
