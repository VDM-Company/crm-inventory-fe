import type { VariantSimulation } from '#shared/types'
import { vertexVariantSimulateSchema } from '#shared/schemas'

/**
 * The Create page's dry run. The product does not exist yet, so this takes
 * the SKU and name it is about to have. Nothing is stored and no SKU is
 * reserved — uniqueness is checked again at create.
 */
export default defineEventHandler(async (event) => {
  const body = await parseBody(event, vertexVariantSimulateSchema)
  return vertex().one<VariantSimulation>('/admin/products/variants/simulate', { method: 'POST', body })
})
