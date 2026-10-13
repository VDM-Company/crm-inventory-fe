/**
 * 409 `in_use` when a variant or a product value ever used it, with the
 * product count in `details.usageCount`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const option = getRouterParam(event, 'option')
  if (!id || !option) throw notFound('attribute option')
  await vertex().none(`/admin/attributes/${id}/options/${option}`, { method: 'DELETE' })
  setResponseStatus(event, 204)
})
