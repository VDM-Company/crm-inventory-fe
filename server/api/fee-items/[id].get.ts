import type { FeeItem } from '#shared/types'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('fee item')
  return vertex().one<FeeItem>(`/admin/fee-items/${id}`)
})
