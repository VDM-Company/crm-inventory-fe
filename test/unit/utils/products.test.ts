import { describe, expect, it } from 'vitest'
import { productById, productSkus } from '../../../app/utils/products'
import type { StoredProduct } from '../../../shared/types/domain'

const product = (id: string, sku: string): StoredProduct => ({
  id,
  name: id,
  sku,
  status: 'Active',
  productType: 'single',
  hasVariants: false,
  variantCount: 0,
  platformIds: []
})

describe('productById', () => {
  it('finds a product, and returns null when it is missing', () => {
    const list = [product('p1', 'SKU-1'), product('p2', 'SKU-2')]
    expect(productById(list, 'p2')?.sku).toBe('SKU-2')
    expect(productById(list, 'nope')).toBeNull()
  })
})

describe('productSkus', () => {
  it('lowercases and trims, since the duplicate check compares case-insensitively', () => {
    const list = [product('p1', '  SKU-1 '), product('p2', 'sku-2')]
    expect(productSkus(list)).toEqual(['sku-1', 'sku-2'])
  })

  it('drops blanks rather than returning empty strings a new SKU could match', () => {
    const list = [product('p1', ''), product('p2', '   '), product('p3', 'SKU-3')]
    expect(productSkus(list)).toEqual(['sku-3'])
  })
})
