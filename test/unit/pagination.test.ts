import { describe, expect, it } from 'vitest'

// Sample for the `unit` project: plain node environment, no Nuxt runtime.
// It restates `usePagination`'s arithmetic rather than importing the
// composable, which needs Vue reactivity — see test/nuxt for that side.
function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize))
}

describe('pagination arithmetic', () => {
  it('always reports at least one page', () => {
    expect(totalPages(0, 8)).toBe(1)
  })

  it('rounds a partial last page up', () => {
    expect(totalPages(45, 8)).toBe(6)
  })
})
