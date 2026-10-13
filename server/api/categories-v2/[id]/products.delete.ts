import { vertexCategoryProductsRemoveSchema } from '#shared/schemas'

/**
 * Answers with what it did: `removed`, and `keptOnPlatform` for products that
 * remain in the category on the given platform because they carry their own
 * categories there. Ids that are not members are ignored rather than refused.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('category')
  const body = await parseBody(event, vertexCategoryProductsRemoveSchema)
  return vertex().one<{ removed: string[], keptOnPlatform: string[] }>(
    `/admin/categories/${id}/products`, { method: 'DELETE', body })
})
