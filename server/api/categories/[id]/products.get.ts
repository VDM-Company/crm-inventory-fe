import type { CatEntry } from '#shared/types'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('categories')
  return backend().getRaw<CatEntry>(`categories/${id}/products`)
})
