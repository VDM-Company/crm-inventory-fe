import type { Fee } from '../types/domain'

/** The one fee every product carries; it cannot be removed or unpublished. */
export const FEE_BASE_ID = 'fee_base'

export const FEE_SEED: Fee[] = [
  { id: FEE_BASE_ID, name: 'Base Price', description: 'Core product price', system: true },
  { id: 'fee_tax', name: 'Tax', description: 'Applicable taxes', system: false },
  { id: 'fee_shipping', name: 'Shipping', description: 'Delivery cost', system: false },
  { id: 'fee_handling', name: 'Handling', description: 'Handling / processing fee', system: false },
  { id: 'fee_insurance', name: 'Insurance', description: 'Optional coverage', system: false }
]
