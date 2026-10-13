import type { AttributeOption } from '#shared/types'
import { vertexAttributeOptionUpdateSchema } from '#shared/schemas'

/**
 * No `lockVersion`: the API versions the attribute, not its options, so this
 * body carries only the fields being changed.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const option = getRouterParam(event, 'option')
  if (!id || !option) throw notFound('attribute option')
  const body = await parseBody(event, vertexAttributeOptionUpdateSchema)
  return vertex().one<AttributeOption>(`/admin/attributes/${id}/options/${option}`, { method: 'PATCH', body })
})
