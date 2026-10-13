import type { BundleOption } from '#shared/types'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('product')
  const data = await vertex().one<BundleOption[]>(`/admin/products/${id}/bundle-options`)
  return { data: data ?? [] }
})
