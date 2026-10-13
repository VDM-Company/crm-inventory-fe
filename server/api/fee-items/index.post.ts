import type { FeeItem } from '#shared/types'
import { feeItemCreateSchema } from '#shared/schemas'

export default defineEventHandler(async (event) => {
  const body = await parseBody(event, feeItemCreateSchema)
  const created = await vertex().one<FeeItem>('/admin/fee-items', { method: 'POST', body })
  setResponseStatus(event, 201)
  return created
})
