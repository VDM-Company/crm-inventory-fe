import type { ProductContent } from '#shared/types'
import { vertexProductPlatformContentSchema } from '#shared/schemas'

/**
 * Override this product's content on one platform, or name fields in `reset`
 * to let Default win again. `lockVersion` is the override's own, from the
 * platform entry in `platform-content`, not the product's.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const platform = getRouterParam(event, 'platform')
  if (!id || !platform) throw notFound('product platform content')
  const body = await parseBody(event, vertexProductPlatformContentSchema)
  return vertex().one<ProductContent>(
    `/admin/products/${id}/platform-content/${platform}`, { method: 'PATCH', body })
})
