import type { VertexCategory } from '#shared/types'
import { vertexCategoryQuerySchema } from '#shared/schemas'

/** One category with its sub-categories, optionally as a platform sees it. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('category')
  const query = await getValidatedQuery(event, vertexCategoryQuerySchema.parse)
  return vertex().one<VertexCategory>(`/admin/categories/${id}`, { query })
})
