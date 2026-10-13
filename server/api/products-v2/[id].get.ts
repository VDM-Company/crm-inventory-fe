import type { VertexProduct } from '#shared/types'
import * as z from 'zod'

const querySchema = z.object({ include: z.enum(['children']).optional() }).loose()

/**
 * The Default values. Per-platform content is its own endpoint.
 *
 * `?include=children` adds a configurable's variants — as LIST rows, not full
 * records, each carrying its `axisValues`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const query = await getValidatedQuery(event, querySchema.parse)
  return vertex().one<VertexProduct>(`/admin/products/${id}`, { query })
})
