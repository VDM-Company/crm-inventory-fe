import type { VertexPlatform } from '#shared/types'

export default defineEventHandler(event =>
  vertexGetHandler<VertexPlatform>(event, '/admin/platforms', 'platform'))
