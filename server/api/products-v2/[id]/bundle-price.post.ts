import type { BundleQuote } from '#shared/types'
import { vertexBundlePriceSchema } from '#shared/schemas'

/**
 * What one set of choices costs: the bundle's own base lines plus each
 * selection's in-bundle price times its quantity. A selection with no
 * in-bundle price costs nothing.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const body = await parseBody(event, vertexBundlePriceSchema)
  return vertex().one<BundleQuote>(`/admin/products/${id}/bundle-price`, { method: 'POST', body })
})
