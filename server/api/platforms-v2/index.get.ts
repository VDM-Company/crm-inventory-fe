import type { VertexPlatform } from '#shared/types'
import { vertexPlatformQuerySchema } from '#shared/schemas'

export default defineEventHandler(event =>
  vertexListHandler<VertexPlatform>(event, '/admin/platforms', vertexPlatformQuerySchema))
