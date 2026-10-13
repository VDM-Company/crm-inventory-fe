import type { Attribute } from '#shared/types'
import { vertexAttributeUpdateSchema } from '#shared/schemas'

export default defineEventHandler(event =>
  vertexUpdateHandler<Attribute>(event, '/admin/attributes', vertexAttributeUpdateSchema, 'attribute'))
