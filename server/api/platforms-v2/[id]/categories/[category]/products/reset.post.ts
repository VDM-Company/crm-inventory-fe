/**
 * Drop a platform's own product order for one category, so it follows the
 * Default order again. 204, no body.
 *
 * Note the shape: this is a platform endpoint that happens to name a
 * category, not a category one — the platform owns the override.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const category = getRouterParam(event, 'category')
  if (!id || !category) throw notFound('platform category order')
  await vertex().none(`/admin/platforms/${id}/categories/${category}/products/reset`, { method: 'POST' })
  setResponseStatus(event, 204)
})
