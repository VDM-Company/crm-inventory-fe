/**
 * Page-number state for the list screens.
 *
 * `page` is kept as written, while `clampedPage` is what the UI should use:
 * when a filter shrinks the list under the current page, the row window has to
 * fall back without the page number fighting the user's next click.
 */
export function usePagination(total: MaybeRefOrGetter<number>, pageSize: number) {
  const page = ref(1)

  const totalPages = computed(() => Math.max(1, Math.ceil(toValue(total) / pageSize)))
  const clampedPage = computed(() => Math.min(page.value, totalPages.value))
  const startIdx = computed(() => (clampedPage.value - 1) * pageSize)
  const endIdx = computed(() => startIdx.value + pageSize)

  const isFirstPage = computed(() => clampedPage.value === 1)
  const isLastPage = computed(() => clampedPage.value === totalPages.value)

  /** Window a list to the current page. */
  function slice<T>(rows: T[]): T[] {
    return rows.slice(startIdx.value, endIdx.value)
  }

  function reset() {
    page.value = 1
  }

  return { page, totalPages, clampedPage, startIdx, endIdx, isFirstPage, isLastPage, slice, reset }
}
