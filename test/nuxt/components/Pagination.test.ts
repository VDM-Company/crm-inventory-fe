import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import VertexPagination from '~/components/vertex/Pagination.vue'

type Wrapper = Awaited<ReturnType<typeof mountSuspended>>

/** Just the numbered buttons — the first and last are the prev/next arrows. */
const pageButtons = (c: Wrapper) =>
  c.findAll('button').filter((b: { text: () => string }) => /^\d+$/.test(b.text()))

describe('VertexPagination', () => {
  it('renders one button per page plus the two arrows', async () => {
    const c = await mountSuspended(VertexPagination, { props: { page: 1, totalPages: 3, label: '1–8 of 20' } })

    expect(c.text()).toContain('1–8 of 20')
    expect(pageButtons(c).map((b: { text: () => string }) => b.text())).toEqual(['1', '2', '3'])
    expect(c.findAll('button')).toHaveLength(5)
  })

  it('marks the current page', async () => {
    const c = await mountSuspended(VertexPagination, { props: { page: 2, totalPages: 3 } })
    const [first, second] = pageButtons(c)

    expect(second!.classes()).toContain('bg-green-500')
    expect(first!.classes()).not.toContain('bg-green-500')
  })

  it('emits the page a user clicks', async () => {
    const c = await mountSuspended(VertexPagination, { props: { page: 1, totalPages: 3 } })

    await pageButtons(c)[2]!.trigger('click')
    expect(c.emitted('update:page')?.[0]).toEqual([3])
  })

  it('steps with the arrows', async () => {
    const c = await mountSuspended(VertexPagination, { props: { page: 2, totalPages: 3 } })
    const all = c.findAll('button')

    await all[0]!.trigger('click')
    await all[all.length - 1]!.trigger('click')

    expect(c.emitted('update:page')).toEqual([[1], [3]])
  })

  it('greys the arrows at each end', async () => {
    const first = await mountSuspended(VertexPagination, { props: { page: 1, totalPages: 3 } })
    expect(first.findAll('button')[0]!.classes()).toContain('cursor-not-allowed')

    const last = await mountSuspended(VertexPagination, { props: { page: 3, totalPages: 3 } })
    const lastButtons = last.findAll('button')
    expect(lastButtons[lastButtons.length - 1]!.classes()).toContain('cursor-not-allowed')
  })
})
