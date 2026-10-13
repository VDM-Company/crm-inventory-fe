import type { Fee, ListQuery, Persisted } from '#shared/types'
import { FEE_BASE_ID } from '#shared/seeds'

/**
 * The reusable Initial-Fee line items.
 *
 * "Base Price" is structural rather than data: every product's pricing carries
 * it, so `list()` puts it back if the API does not return it. That guard came
 * from the localStorage loader this replaced, and it belongs to the whole list,
 * not to a single row — which is why it wraps `list` instead of riding along in
 * the row normalizer.
 *
 * `page()` deliberately does not apply it. Inserting a row the API did not send
 * would put the returned `meta` counts out of step with the rows beside them,
 * and a synthetic row prepended to page 2 would be wrong anyway.
 */
export function useApiFees() {
  const api = useApiResource<Fee>('fees', f => ({
    id: f.id,
    name: f.name,
    icon: f.icon,
    description: f.description || '',
    system: !!f.system
  }))

  return {
    ...api,
    list: async (query?: ListQuery): Promise<Persisted<Fee>[]> => {
      const fees = await api.list(query)
      if (!fees.some(f => f.id === FEE_BASE_ID)) {
        fees.unshift({ id: FEE_BASE_ID, name: 'Base Price', description: 'Core product price', system: true })
      }
      return fees
    }
  }
}
