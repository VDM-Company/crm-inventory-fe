import type { VertexCategory } from '#shared/types'
import { vertexCategoryUpdateSchema } from '#shared/schemas'

/**
 * Moving is a `parentId` change. Under its own descendant is 422
 * `category_cycle`; past three levels is 422 `category_too_deep`.
 */
export default defineEventHandler(event =>
  vertexUpdateHandler<VertexCategory>(event, '/admin/categories', vertexCategoryUpdateSchema, 'category'))
