import type { VertexPlatform } from '#shared/types'

export default defineEventHandler(event =>
  vertexActionHandler<VertexPlatform>(event, '/admin/platforms', 'deactivate', 'platform'))
