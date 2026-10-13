import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, ref } from 'vue'

/** Runs a composable inside a real component so lifecycle hooks work. */
async function withSetup<T>(fn: () => T) {
  let result!: T
  const wrapper = await mountSuspended(defineComponent({
    setup() {
      result = fn()
      return () => null
    }
  }))
  return { result, wrapper }
}

describe('usePagination', () => {
  it('always reports at least one page, even with nothing to show', async () => {
    const { result } = await withSetup(() => usePagination(() => 0, 8))
    expect(result.totalPages.value).toBe(1)
    expect(result.clampedPage.value).toBe(1)
  })

  it('rounds a partial last page up', async () => {
    const { result } = await withSetup(() => usePagination(() => 45, 8))
    expect(result.totalPages.value).toBe(6)
  })

  it('windows a list to the current page', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => i)
    const { result } = await withSetup(() => usePagination(() => rows.length, 8))

    expect(result.slice(rows)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    result.page.value = 3
    expect(result.slice(rows)).toEqual([16, 17, 18, 19])
  })

  it('falls back to the last page when the list shrinks under the current page', async () => {
    // the reason `clampedPage` exists: a filter must not strand the user on an
    // empty page while `page` still points past the end
    const total = ref(45)
    const { result } = await withSetup(() => usePagination(() => total.value, 8))

    result.page.value = 6
    expect(result.clampedPage.value).toBe(6)
    expect(result.startIdx.value).toBe(40)

    total.value = 10
    expect(result.totalPages.value).toBe(2)
    expect(result.clampedPage.value).toBe(2)
    expect(result.startIdx.value).toBe(8)
    // `page` itself is untouched, so going back up does not need a re-click
    expect(result.page.value).toBe(6)
  })

  it('tracks first and last page', async () => {
    const { result } = await withSetup(() => usePagination(() => 20, 8))
    expect(result.isFirstPage.value).toBe(true)
    expect(result.isLastPage.value).toBe(false)

    result.page.value = 3
    expect(result.isFirstPage.value).toBe(false)
    expect(result.isLastPage.value).toBe(true)
  })

  it('resets to the first page', async () => {
    const { result } = await withSetup(() => usePagination(() => 45, 8))
    result.page.value = 4
    result.reset()
    expect(result.page.value).toBe(1)
  })
})
