import type { VertexCategory } from '#shared/types'
import { vertexCategoryQuerySchema } from '#shared/schemas'

/**
 * The whole tree, nested, in one response.
 *
 * Not `vertexListHandler`: this endpoint takes no cursor and sends no `meta`,
 * so walking cursors would be wrong. The shape is kept list-like so callers
 * read it the same way as every other list.
 */
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, vertexCategoryQuerySchema.parse)
  const data = await vertex().one<VertexCategory[]>('/admin/categories', { query })
  return { data: data ?? [], meta: { nextCursor: null, prevCursor: null } }
})
