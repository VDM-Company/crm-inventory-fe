import { describe, expect, it } from 'vitest'
import { feeById, feeUsageCount } from '../../../app/utils/fees'
import type { Fee, StoredProduct } from '../../../shared/types/domain'

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

describe('feeUsageCount', () => {
  const product = (id: string, feeIds: string[]): StoredProduct => ({
    id,
    name: id,
    sku: id,
    status: 'Active',
    productType: 'single',
    hasVariants: false,
    variantCount: 0,
    platformIds: [],
    pricing: [{ components: feeIds.map(feeId => ({ feeId, published: true, amount: '1' })) }]
  })

  it('counts the products that reference the fee', () => {
    const products = [product('p1', ['fee_base', 'fee_tax']), product('p2', ['fee_base'])]
    expect(feeUsageCount(products, 'fee_base')).toBe(2)
    expect(feeUsageCount(products, 'fee_tax')).toBe(1)
    expect(feeUsageCount(products, 'fee_shipping')).toBe(0)
  })

  it('ignores products with no pricing at all', () => {
    const bare = { ...product('p3', []), pricing: undefined }
    expect(feeUsageCount([bare], 'fee_base')).toBe(0)
  })

  it('counts a product once even if several versions use the fee', () => {
    const multi = product('p4', ['fee_base'])
    multi.pricing = [
      { components: [{ feeId: 'fee_base', published: true, amount: '1' }] },
      { components: [{ feeId: 'fee_base', published: true, amount: '2' }] }
    ]
    expect(feeUsageCount([multi], 'fee_base')).toBe(1)
  })
})
