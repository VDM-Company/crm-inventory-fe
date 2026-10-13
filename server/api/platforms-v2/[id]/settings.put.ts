import type { VertexPlatformSettings } from '#shared/types'
import { vertexPlatformSettingsUpdateSchema } from '#shared/schemas'

/**
 * PUT, not PATCH: the API documents this one as a full replace — a group left
 * out is cleared, not kept. It needs the `lockVersion` from the last GET.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('platform')
  const body = await parseBody(event, vertexPlatformSettingsUpdateSchema)
  return vertex().one<VertexPlatformSettings>(`/admin/platforms/${id}/settings`, { method: 'PUT', body })
})
