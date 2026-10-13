import type { VertexProduct } from '#shared/types'
import { vertexProductCreateSchema } from '#shared/schemas'

/** Creates product data only; prices come from the price-plan endpoints. */
export default defineEventHandler(event =>
  vertexCreateHandler<VertexProduct>(event, '/admin/products', vertexProductCreateSchema))
