import type { PricePlan } from '#shared/types'

/**
 * Cancel a plan that has not taken effect yet.
 *
 * Scheduled plans only — anything else is 409 `invalid_transition`, which is
 * the API's way of saying the price is already in force and history is not
 * rewritten.
 */
export default defineEventHandler(async (event) => {
  const plan = getRouterParam(event, 'plan')
  if (!plan) throw notFound('price plan')
  return vertex(event).one<PricePlan>(`/admin/price-plans/${plan}/cancel`, { method: 'POST' })
})
