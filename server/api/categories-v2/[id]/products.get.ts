import type { VertexCategoryProduct } from '#shared/types'
import { vertexCategoryProductsQuerySchema } from '#shared/schemas'

/**
 * The products assigned directly to this category, in the order customers
 * see them. With `platformId` the order and membership are that platform's,
 * and `meta.scope` says which.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('category')
  return vertexListHandler<VertexCategoryProduct>(
    event, `/admin/categories/${id}/products`, vertexCategoryProductsQuerySchema)
})
