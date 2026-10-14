import { describe, expect, it } from 'vitest'
import { thisMonthLabel, toDashStatValues } from '../../shared/utils/catalog-stats'
import type { CatalogStats } from '../../shared/types/vertex'

// the collection's own saved example
const EXAMPLE: CatalogStats = {
  productsByStatus: { draft: 1, active: 4, inactive: 0, trashed: 2 },
  productsByType: { single: 2, variant: 2, bundle: 1 },
  createdThisMonth: 5,
  createdThisMonthByType: { single: 2, variant: 2, bundle: 1 },
  outOfStockProducts: 0
}

describe('toDashStatValues', () => {
  it('maps the collection example onto the four tiles', () => {
    expect(toDashStatValues(EXAMPLE)).toEqual({
      // 1 draft + 4 active + 0 inactive; the 2 trashed are not in the catalogue
      total: 5,
      active: 4,
      withVariants: 2,
      lowStock: 0,
      createdThisMonth: 5,
      variantsCreatedThisMonth: 2,
      activePercent: 80
    })
  })

  it('leaves trashed products out of the total', () => {
    // every list on the screen filters them out, so counting them here would
    // make "Total" disagree with what the reader can see
    const noTrash = { ...EXAMPLE, productsByStatus: { draft: 1, active: 4, inactive: 0, trashed: 0 } }
    expect(toDashStatValues(noTrash).total).toBe(5)
    const lotsOfTrash = { ...EXAMPLE, productsByStatus: { draft: 1, active: 4, inactive: 0, trashed: 99 } }
    expect(toDashStatValues(lotsOfTrash).total).toBe(5)
  })

  it('counts draft and inactive products in the total', () => {
    const stats = { ...EXAMPLE, productsByStatus: { draft: 3, active: 1, inactive: 2, trashed: 0 } }
    expect(toDashStatValues(stats).total).toBe(6)
  })

  it('reads the variant bucket by the name THIS endpoint uses', () => {
    // it says `variant`; every product endpoint says `configurable`. Reading
    // the wrong one is silently always zero.
    expect(toDashStatValues({ ...EXAMPLE, productsByType: { variant: 7 } }).withVariants).toBe(7)
    expect(toDashStatValues({ ...EXAMPLE, productsByType: { configurable: 7 } }).withVariants).toBe(7)
  })

  it('survives an empty catalogue without printing NaN%', () => {
    const empty: CatalogStats = {
      productsByStatus: {},
      productsByType: {},
      createdThisMonth: 0,
      createdThisMonthByType: {},
      outOfStockProducts: 0
    }
    expect(toDashStatValues(empty)).toEqual({
      total: 0, active: 0, withVariants: 0, lowStock: 0,
      createdThisMonth: 0, variantsCreatedThisMonth: 0, activePercent: 0
    })
  })

  it('renders zeroes rather than throwing when the fetch gave nothing', () => {
    expect(toDashStatValues(null).total).toBe(0)
    expect(toDashStatValues(undefined).activePercent).toBe(0)
  })

  it('ignores a bucket the API gains later instead of miscounting', () => {
    // `.loose()` forwards unknown fields, so a new status WILL arrive here
    const withNew = { ...EXAMPLE, productsByStatus: { ...EXAMPLE.productsByStatus, scheduled: 3 } }
    // it counts toward the total, because it is a product that exists
    expect(toDashStatValues(withNew).total).toBe(8)
    expect(toDashStatValues(withNew).active).toBe(4)
  })

  it('rounds the active share rather than printing a fraction', () => {
    const stats = { ...EXAMPLE, productsByStatus: { draft: 0, active: 1, inactive: 2, trashed: 0 } }
    expect(toDashStatValues(stats).activePercent).toBe(33)
  })
})

describe('thisMonthLabel', () => {
  it('reads as a delta when there is one', () => {
    expect(thisMonthLabel(12)).toBe('+12 this month')
  })

  it('does not claim "+0 this month"', () => {
    expect(thisMonthLabel(0)).toBe('None this month')
  })
})
