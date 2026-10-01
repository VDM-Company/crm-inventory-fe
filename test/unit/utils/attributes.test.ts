import { describe, expect, it } from 'vitest'
import {
  attributeAvailableFor,
  attributeNames,
  attributeTypeFor,
  attributeUsageCount,
  attributeValuesFor
} from '../../../app/utils/attributes'
import type { AttributeDef, StoredProduct } from '../../../shared/types/domain'

const defs: AttributeDef[] = [
  { id: 'a_data', name: 'Data', type: 'Select', values: ['5GB', '10GB', '15GB'] },
  { id: 'a_color', name: 'Color', values: ['Black', 'White'] },
  { id: 'a_model', name: 'Model Type', type: 'Text', values: [] }
]

describe('attributeNames', () => {
  it('lists the names in order', () => {
    expect(attributeNames(defs)).toEqual(['Data', 'Color', 'Model Type'])
  })
})

describe('attributeTypeFor', () => {
  it('returns the declared type', () => {
    expect(attributeTypeFor(defs, 'Model Type')).toBe('Text')
  })

  it('falls back to Select for legacy rows with no type, and for unknown names', () => {
    expect(attributeTypeFor(defs, 'Color')).toBe('Select')
    expect(attributeTypeFor(defs, 'Nothing')).toBe('Select')
  })
})

describe('attributeValuesFor', () => {
  it('returns a copy, so a caller cannot mutate the store', () => {
    const values = attributeValuesFor(defs, 'Data')
    expect(values).toEqual(['5GB', '10GB', '15GB'])

    values.push('20GB')
    expect(attributeValuesFor(defs, 'Data')).toEqual(['5GB', '10GB', '15GB'])
  })

  it('is empty for an unknown attribute', () => {
    expect(attributeValuesFor(defs, 'Nothing')).toEqual([])
  })
})

describe('attributeAvailableFor', () => {
  it('drops the values already chosen', () => {
    expect(attributeAvailableFor(defs, 'Data', ['10GB'])).toEqual(['5GB', '15GB'])
    expect(attributeAvailableFor(defs, 'Data', [])).toEqual(['5GB', '10GB', '15GB'])
  })

  it('is empty once everything is taken', () => {
    expect(attributeAvailableFor(defs, 'Color', ['Black', 'White'])).toEqual([])
  })
})

describe('attributeUsageCount', () => {
  const product = (id: string, names: string[]): StoredProduct => ({
    id,
    name: id,
    sku: id,
    status: 'Active',
    productType: 'variant',
    hasVariants: true,
    variantCount: 1,
    platformIds: [],
    attributes: names.map(name => ({ name, values: [] }))
  })

  it('counts the products using the attribute', () => {
    const products = [product('p1', ['Data', 'Color']), product('p2', ['Data'])]
    expect(attributeUsageCount(products, 'Data')).toBe(2)
    expect(attributeUsageCount(products, 'Color')).toBe(1)
    expect(attributeUsageCount(products, 'Size')).toBe(0)
  })

  it('matches case-insensitively, since the name is free text', () => {
    expect(attributeUsageCount([product('p1', ['Data'])], 'data')).toBe(1)
  })

  it('ignores products with no attributes', () => {
    const bare = { ...product('p3', []), attributes: undefined }
    expect(attributeUsageCount([bare], 'Data')).toBe(0)
  })
})
