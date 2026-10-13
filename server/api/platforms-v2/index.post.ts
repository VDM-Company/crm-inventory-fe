import type { VertexPlatform } from '#shared/types'
import { vertexPlatformCreateSchema } from '#shared/schemas'

export default defineEventHandler(event =>
  vertexCreateHandler<VertexPlatform>(event, '/admin/platforms', vertexPlatformCreateSchema))
