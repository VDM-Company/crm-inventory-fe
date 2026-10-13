import type { Attribute } from '#shared/types'
import { vertexAttributeOptionOrderSchema } from '#shared/schemas'

/**
 * Sets the whole order at once and answers with the entire attribute, not
 * just the options — so a caller can replace its copy wholesale.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('attribute')
  const body = await parseBody(event, vertexAttributeOptionOrderSchema)
  return vertex().one<Attribute>(`/admin/attributes/${id}/options/order`, { method: 'PUT', body })
})
