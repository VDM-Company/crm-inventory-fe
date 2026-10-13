import { describe, expect, it } from 'vitest'
import { apiErrorMessage, apiFieldErrors } from '../../app/composables/useApi'

// Pure helpers, so they run in the fast `unit` project with no Nuxt runtime.
// They unwrap what `createError({ data })` hands the client, which nests one
// level deeper than people expect.
describe('apiFieldErrors', () => {
  it('reads the 422 field errors off a thrown response', () => {
    const err = { data: { data: { message: 'Invalid', fieldErrors: { name: 'Name is required' } } } }
    expect(apiFieldErrors(err)).toEqual({ name: 'Name is required' })
  })

  it('also reads them when the body is not double-wrapped', () => {
    const err = { data: { fieldErrors: { sku: 'Already taken' } } }
    expect(apiFieldErrors(err)).toEqual({ sku: 'Already taken' })
  })

  it('returns nothing for a failure that is not a 422', () => {
    expect(apiFieldErrors({ data: { data: { message: 'Server error' } } })).toEqual({})
    expect(apiFieldErrors(new Error('network'))).toEqual({})
    expect(apiFieldErrors(undefined)).toEqual({})
  })
})

describe('apiErrorMessage', () => {
  it('prefers the message the server sent', () => {
    expect(apiErrorMessage({ data: { data: { message: 'upstream exploded' } } })).toBe('upstream exploded')
    expect(apiErrorMessage({ data: { message: 'plain' } })).toBe('plain')
  })

  it('falls back when the failure carries no message', () => {
    expect(apiErrorMessage(new Error('boom'), 'Could not save.')).toBe('Could not save.')
    expect(apiErrorMessage(undefined)).toBe('Something went wrong.')
  })
})
