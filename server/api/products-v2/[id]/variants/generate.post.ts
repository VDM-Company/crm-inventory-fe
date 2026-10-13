import type { VariantGenerateResult } from '#shared/types'
import { vertexVariantGenerateSchema } from '#shared/schemas'

/**
 * Creates the variants as child products. Prices are NOT set here — they come
 * afterwards through the price-plan endpoints.
 *
 * A large set runs as a job: the API answers 202 with a `job_id` instead of
 * the products, so a caller has to handle both. The status code is passed
 * through rather than normalised, because 202 means "come back later" and
 * 200 does not.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const body = await parseBody(event, vertexVariantGenerateSchema)
  return vertex().one<VariantGenerateResult>(`/admin/products/${id}/variants/generate`, { method: 'POST', body })
})
