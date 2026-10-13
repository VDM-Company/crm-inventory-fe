import type { ConfigValues } from '#shared/types'
import { configValuesSchema } from '#shared/schemas'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('platforms')
  const body = await parseBody(event, configValuesSchema)
  return backend().putRaw<ConfigValues>(`platforms/${id}/config`, body)
})
