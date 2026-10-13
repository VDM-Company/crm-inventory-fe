import type { VertexProduct } from '#shared/types'

/**
 * Brings a trashed product back — as Draft if it never left Draft, else
 * Inactive. 409 `restore_expired` past the retention period,
 * `invalid_transition` when it was not deleted.
 */
export default defineEventHandler(event =>
  vertexActionHandler<VertexProduct>(event, '/admin/products', 'restore', 'product'))
