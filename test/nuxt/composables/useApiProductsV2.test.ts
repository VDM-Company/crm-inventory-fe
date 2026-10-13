import { describe, expect, it } from 'vitest'
import type { VertexProduct } from '#shared/types'

/**
 * `lockedFields` is the one place the API's field names reach the app as data
 * rather than as keys, so the case mapper never touches them.
 */
const product = (lockedFields: string[]) => ({ lockedFields } as VertexProduct)

describe('isLockedField', () => {
  it('matches the camelCase name a form knows against the API spelling', () => {
    const p = product(['sku', 'is_subscription', 'requires_shipping'])

    expect(isLockedField(p, 'isSubscription')).toBe(true)
    expect(isLockedField(p, 'requiresShipping')).toBe(true)
    expect(isLockedField(p, 'sku')).toBe(true)
  })

  it('still matches when the API sends camelCase instead', () => {
    expect(isLockedField(product(['isSubscription']), 'isSubscription')).toBe(true)
  })

  it('does not lock a field that is not in the list', () => {
    const p = product(['sku'])

    expect(isLockedField(p, 'name')).toBe(false)
    expect(isLockedField(p, 'isGift')).toBe(false)
  })

  it('treats a product with no locked fields as fully editable', () => {
    expect(isLockedField({} as VertexProduct, 'sku')).toBe(false)
    expect(isLockedField(product([]), 'sku')).toBe(false)
  })
})
