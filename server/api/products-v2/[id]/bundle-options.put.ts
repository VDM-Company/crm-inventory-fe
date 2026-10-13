import type { BundleOption } from '#shared/types'
import { vertexBundleOptionsSchema } from '#shared/schemas'

/**
 * Replaces the bundle's contents. An id that already belongs to the bundle is
 * kept, and keeps the in-bundle prices attached to it; anything else is given
 * a new id — so a selection re-added without its id loses its price.
 *
 * The bundle's stock and `requiresShipping` are recomputed from the contents.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const body = await parseBody(event, vertexBundleOptionsSchema)
  const data = await vertex().one<BundleOption[]>(
    `/admin/products/${id}/bundle-options`, { method: 'PUT', body })
  return { data: data ?? [] }
})
