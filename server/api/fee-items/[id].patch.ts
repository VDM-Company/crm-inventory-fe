import type { FeeItem } from '#shared/types'
import { feeItemUpdateSchema } from '#shared/schemas'

/**
 * PATCH, not PUT: the API patches versioned resources and answers 409
 * `stale_version` when the `lockVersion` in the body is behind.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('fee item')
  const body = await parseBody(event, feeItemUpdateSchema)
  return vertex().one<FeeItem>(`/admin/fee-items/${id}`, { method: 'PATCH', body })
})
