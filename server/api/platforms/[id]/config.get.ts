import type { ConfigValues } from '#shared/types'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('platforms')
  return backend().getRaw<ConfigValues>(`platforms/${id}/config`)
})
