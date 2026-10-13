import type { FeeItem } from '#shared/types'
import { feeItemQuerySchema } from '#shared/schemas'

/**
 * One page of fee items.
 *
 * Cursor-paginated upstream, so this forwards `cursor` and returns the API's
 * `meta` rather than page numbers. Callers that want the whole list use
 * `?all=true` — fee items are master data a screen renders in full.
 */
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, feeItemQuerySchema.parse)
  const { all, ...rest } = query as Record<string, unknown>

  if (all) {
    const data = await vertex().all<FeeItem>('/admin/fee-items', rest)
    return { data, meta: { nextCursor: null, prevCursor: null, total: data.length } }
  }
  return vertex().page<FeeItem>('/admin/fee-items', rest)
})
