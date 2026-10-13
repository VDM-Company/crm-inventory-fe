import type { AttributeOption } from '#shared/types'
import { vertexAttributeOptionCreateSchema } from '#shared/schemas'

/** Returns the new option alone, not the attribute it belongs to. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('attribute')
  const body = await parseBody(event, vertexAttributeOptionCreateSchema)
  const created = await vertex().one<AttributeOption>(`/admin/attributes/${id}/options`, { method: 'POST', body })
  setResponseStatus(event, 201)
  return created
})
