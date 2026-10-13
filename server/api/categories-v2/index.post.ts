import type { VertexCategory } from '#shared/types'
import { vertexCategoryCreateSchema } from '#shared/schemas'

/** 422 `name_not_unique` within a parent, `category_too_deep` past 3 levels. */
export default defineEventHandler(event =>
  vertexCreateHandler<VertexCategory>(event, '/admin/categories', vertexCategoryCreateSchema))
