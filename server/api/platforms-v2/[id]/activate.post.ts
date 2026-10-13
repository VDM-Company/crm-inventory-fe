import type { VertexPlatform } from '#shared/types'

/** There is no DELETE for a platform; this and `deactivate` are the switch. */
export default defineEventHandler(event =>
  vertexActionHandler<VertexPlatform>(event, '/admin/platforms', 'activate', 'platform'))
