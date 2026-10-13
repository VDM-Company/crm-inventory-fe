import type { VertexProduct } from '#shared/types'

/** The Default values. Per-platform content is its own endpoint. */
export default defineEventHandler(event =>
  vertexGetHandler<VertexProduct>(event, '/admin/products', 'product'))
