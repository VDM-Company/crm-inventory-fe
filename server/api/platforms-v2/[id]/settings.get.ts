import type { VertexPlatformSettings } from '#shared/types'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('platform')
  return vertex().one<VertexPlatformSettings>(`/admin/platforms/${id}/settings`)
})
