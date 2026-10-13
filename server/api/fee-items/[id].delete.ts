/**
 * 204 on success. The API refuses with 409 `system_fee_item` for the seeded
 * Base Price / Tax / Shipping rows, and 409 `in_use` when any price line
 * references it — that one carries the count in `details.usageCount`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('fee item')
  await vertex().none(`/admin/fee-items/${id}`, { method: 'DELETE' })
  setResponseStatus(event, 204)
})
