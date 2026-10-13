import { describe, expect, it } from 'vitest'
import { feeById } from '../../../app/utils/fees'
import type { Fee } from '../../../shared/types/domain'

const fees: Fee[] = [
  { id: 'fee_base', name: 'Base Price', description: 'Core product price', system: true },
  { id: 'fee_tax', name: 'Tax', description: 'Applicable taxes', system: false }
]

describe('feeById', () => {
  it('finds a fee, and returns null rather than undefined when it is missing', () => {
    expect(feeById(fees, 'fee_tax')?.name).toBe('Tax')
    expect(feeById(fees, 'nope')).toBeNull()
  })
})
