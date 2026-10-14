import type { Attribute } from '#shared/types'

export default defineEventHandler(event =>
  vertexGetHandler<Attribute>(event, '/admin/attributes', 'attribute'))
