import type { CatEntry } from '#shared/types'
import { categoryProductsSchema } from '#shared/schemas'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('categories')
  const body = await parseBody(event, categoryProductsSchema)
  return backend().putRaw<CatEntry>(`categories/${id}/products`, body)
})
