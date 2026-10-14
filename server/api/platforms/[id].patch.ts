import type { VertexPlatform } from '#shared/types'
import { vertexPlatformUpdateSchema } from '#shared/schemas'

export default defineEventHandler(event =>
  vertexUpdateHandler<VertexPlatform>(event, '/admin/platforms', vertexPlatformUpdateSchema, 'platform'))
