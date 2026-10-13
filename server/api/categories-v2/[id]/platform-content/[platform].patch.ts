import type { VertexCategory } from '#shared/types'
import { vertexCategoryPlatformContentSchema } from '#shared/schemas'

/**
 * Override one category for one platform, or send `reset` to let fields
 * follow Default again. `lockVersion` here is the override's own, from
 * `platform.lockVersion` — not the category's.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const platform = getRouterParam(event, 'platform')
  if (!id || !platform) throw notFound('category platform content')
  const body = await parseBody(event, vertexCategoryPlatformContentSchema)
  return vertex().one<VertexCategory>(
    `/admin/categories/${id}/platform-content/${platform}`, { method: 'PATCH', body })
})
