import { describe, expect, it } from 'vitest'
import { can, isGuardedApiPath, isSessionEnding, safeRedirect, toSessionUser } from '../../shared/utils/auth'
import type { AdminUser } from '../../shared/types/vertex'

describe('isGuardedApiPath', () => {
  it('guards every API route', () => {
    expect(isGuardedApiPath('/api/products-v2')).toBe(true)
    expect(isGuardedApiPath('/api/fee-items/abc')).toBe(true)
    expect(isGuardedApiPath('/api/auth/logout')).toBe(true)
    expect(isGuardedApiPath('/api/auth/me')).toBe(true)
  })

  it('lets exactly two through', () => {
    expect(isGuardedApiPath('/api/auth/login')).toBe(false)
    expect(isGuardedApiPath('/api/_health')).toBe(false)
  })

  it('matches the exceptions exactly, not by prefix', () => {
    // the reason the allowlist is a Set of whole paths: a `startsWith` check
    // would make every one of these public too
    expect(isGuardedApiPath('/api/auth/login-as')).toBe(true)
    expect(isGuardedApiPath('/api/auth/login/elevate')).toBe(true)
    expect(isGuardedApiPath('/api/_healthcheck')).toBe(true)
    expect(isGuardedApiPath('/api/_health/secrets')).toBe(true)
  })

  it('ignores a query string and a trailing slash', () => {
    expect(isGuardedApiPath('/api/auth/login?next=/x')).toBe(false)
    expect(isGuardedApiPath('/api/auth/login/')).toBe(false)
    expect(isGuardedApiPath('/api/products-v2?limit=10')).toBe(true)
  })

  it('leaves pages and assets alone', () => {
    // a signed-out visitor still has to be served the login page and the
    // JavaScript that renders it
    expect(isGuardedApiPath('/login')).toBe(false)
    expect(isGuardedApiPath('/dashboard')).toBe(false)
    expect(isGuardedApiPath('/_nuxt/entry.js')).toBe(false)
    expect(isGuardedApiPath('/')).toBe(false)
    // and nothing that merely contains the word
    expect(isGuardedApiPath('/products/api/thing')).toBe(false)
  })
})

describe('safeRedirect', () => {
  it('keeps a path on this site, query and hash included', () => {
    expect(safeRedirect('/products/detail?id=abc')).toBe('/products/detail?id=abc')
    expect(safeRedirect('/categories#tree')).toBe('/categories#tree')
  })

  it('refuses another origin', () => {
    // `//evil.test` is protocol-relative: a browser reads it as another site
    expect(safeRedirect('//evil.test')).toBe('/dashboard')
    expect(safeRedirect('//evil.test/path')).toBe('/dashboard')
    expect(safeRedirect('https://evil.test')).toBe('/dashboard')
    expect(safeRedirect('http://evil.test')).toBe('/dashboard')
    // some browsers normalise the backslash to a slash, making this `//`
    expect(safeRedirect('/\\evil.test')).toBe('/dashboard')
  })

  it('refuses anything that is not a path', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe('/dashboard')
    expect(safeRedirect('dashboard')).toBe('/dashboard')
    expect(safeRedirect('')).toBe('/dashboard')
    expect(safeRedirect(undefined)).toBe('/dashboard')
    expect(safeRedirect(null)).toBe('/dashboard')
    // a repeated ?redirect= arrives as an array
    expect(safeRedirect(['/a', '/b'])).toBe('/dashboard')
  })

  it('refuses the login page, which would bounce forever', () => {
    expect(safeRedirect('/login')).toBe('/dashboard')
    expect(safeRedirect('/login?redirect=/login')).toBe('/dashboard')
  })

  it('takes the caller’s fallback', () => {
    expect(safeRedirect('//evil.test', '/categories')).toBe('/categories')
  })
})

describe('toSessionUser', () => {
  const user = {
    id: 'u1',
    name: 'Hana Sato',
    email: 'hana.sato@example.jp',
    status: 'active',
    roles: [{ id: 'r1', name: 'super_admin' }],
    permissions: ['products.view', 'products.update'],
    hasPassword: true,
    socialProviders: [],
    lastLoginAt: null,
    lockVersion: 1,
    createdAt: '2026-10-07T14:33:12.039Z'
  } as AdminUser

  it('keeps only what a screen shows, and flattens roles to names', () => {
    expect(toSessionUser(user)).toEqual({
      id: 'u1',
      name: 'Hana Sato',
      email: 'hana.sato@example.jp',
      roles: ['super_admin'],
      permissions: ['products.view', 'products.update']
    })
  })

  it('carries no token, whatever the document holds', () => {
    // the token belongs in the sealed cookie; anything on this object is
    // handed to the browser
    const withToken = { ...user, token: '1|secret' } as unknown as AdminUser
    expect(JSON.stringify(toSessionUser(withToken))).not.toContain('secret')
  })

  it('survives a user with no roles or permissions', () => {
    const bare = { ...user, roles: undefined, permissions: undefined } as unknown as AdminUser
    expect(toSessionUser(bare).roles).toEqual([])
    expect(toSessionUser(bare).permissions).toEqual([])
  })
})

describe('can', () => {
  const user = toSessionUser({
    id: 'u1',
    name: 'H',
    email: 'h@x.jp',
    status: 'active',
    roles: [],
    permissions: ['products.view'],
    hasPassword: true,
    socialProviders: [],
    lastLoginAt: null,
    lockVersion: 1,
    createdAt: ''
  } as AdminUser)

  it('answers from the permission list', () => {
    expect(can(user, 'products.view')).toBe(true)
    expect(can(user, 'products.delete')).toBe(false)
  })

  it('is false without a user, rather than throwing', () => {
    expect(can(null, 'products.view')).toBe(false)
    expect(can(undefined, 'products.view')).toBe(false)
  })
})

describe('isSessionEnding', () => {
  it('ends the session for a credential that is finished', () => {
    expect(isSessionEnding('unauthenticated')).toBe(true)
    expect(isSessionEnding('token_expired')).toBe(true)
    expect(isSessionEnding('account_inactive')).toBe(true)
  })

  it('does not end it for a wrong password, which has no session to end', () => {
    expect(isSessionEnding('invalid_credential')).toBe(false)
  })

  it('does not end it for a code it does not recognise', () => {
    // the bug this exists for: the Postman mock answers some writes with a
    // saved 401 whose code is the literal string "string", which used to log
    // someone out every time they saved a price
    expect(isSessionEnding('string')).toBe(false)
    expect(isSessionEnding('rate_limited')).toBe(false)
    expect(isSessionEnding('not_found')).toBe(false)
  })

  it('does not end it for a missing or non-string code', () => {
    expect(isSessionEnding(undefined)).toBe(false)
    expect(isSessionEnding(null)).toBe(false)
    expect(isSessionEnding(401)).toBe(false)
    expect(isSessionEnding({ code: 'unauthenticated' })).toBe(false)
  })
})
