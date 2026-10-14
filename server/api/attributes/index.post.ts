import type { Attribute } from '#shared/types'
import { vertexAttributeCreateSchema } from '#shared/schemas'

export default defineEventHandler(event =>
  vertexCreateHandler<Attribute>(event, '/admin/attributes', vertexAttributeCreateSchema))
