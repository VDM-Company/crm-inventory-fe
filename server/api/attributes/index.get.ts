import type { Attribute } from '#shared/types'
import { vertexAttributeQuerySchema } from '#shared/schemas'

export default defineEventHandler(event =>
  vertexListHandler<Attribute>(event, '/admin/attributes', vertexAttributeQuerySchema))
