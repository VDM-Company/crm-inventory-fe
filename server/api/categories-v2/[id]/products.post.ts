import { vertexCategoryProductsAddSchema } from '#shared/schemas'

/** Appends to the end of every order. A variant is 422 `field_inherited`. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw notFound('category')
  const body = await parseBody(event, vertexCategoryProductsAddSchema)
  return vertex().one<{ assigned: boolean }>(`/admin/categories/${id}/products`, { method: 'POST', body })
})
