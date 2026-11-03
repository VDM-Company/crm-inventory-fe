import type { PricePlan } from '#shared/types'

/**
 * Price plans addressed by their own id.
 *
 * Separate from `useApiProducts()` because the API addresses them that way:
 * creating one is `POST /products/:id/price-plans`, but acting on an
 * existing plan is `/price-plans/:plan/…`, with no product in the path.
 */
export function useApiPricePlans() {
  const http = useApiFetch()

  /**
   * Cancel a plan that has not taken effect yet. Scheduled plans only —
   * 409 `invalid_transition` for any other status.
   */
  const cancel = (planId: string) =>
    http<PricePlan>(`/api/price-plans/${planId}/cancel`, { method: 'POST' })

  return { cancel }
}
