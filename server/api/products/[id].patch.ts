import type { VertexProduct } from '#shared/types'
import { vertexProductUpdateSchema } from '#shared/schemas'

/** 422 `field_locked` for a field in `lockedFields` once out of Draft. */
export default defineEventHandler(event =>
  vertexUpdateHandler<VertexProduct>(event, '/admin/products', vertexProductUpdateSchema, 'product'))
