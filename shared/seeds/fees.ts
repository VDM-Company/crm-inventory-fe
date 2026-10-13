import type { Fee } from '../types/domain'

/**
 * The Vertex Commerce mock's fee items, with its real ids.
 *
 * All three are system rows upstream (`is_system: true`), which is why none
 * of them can be deleted on the Pricing screen any more.
 */
export const FEE_BASE_ID = '01a116c8-5bb9-7015-ade8-524d8e5a9617'
export const FEE_TAX_ID = '01a116c8-5bbc-7366-bf20-3dd85e4ecd21'
export const FEE_SHIPPING_ID = '01a116c8-5bbd-7a3a-a162-2181f12499fd'

export const FEE_SEED: Fee[] = [
  { id: FEE_BASE_ID, name: 'Base Price', description: 'Core product price', system: true },
  { id: FEE_TAX_ID, name: 'Tax', description: '', system: true },
  { id: FEE_SHIPPING_ID, name: 'Shipping', description: '', system: true }
]
