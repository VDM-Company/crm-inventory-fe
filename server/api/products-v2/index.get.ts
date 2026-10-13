import type { VertexProductRow } from '#shared/types'
import { vertexProductQuerySchema } from '#shared/schemas'

/**
 * The product list.
 *
 * Note the row type: this endpoint answers with a different shape from
 * `GET :id`, with names and prices already resolved. `?all=true` is available
 * but should not be used here — this list is unbounded, and the screen pages
 * it with the cursor.
 */
export default defineEventHandler(event =>
  vertexListHandler<VertexProductRow>(event, '/admin/products', vertexProductQuerySchema))
