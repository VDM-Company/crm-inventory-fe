import { describe, expect, it, vi } from 'vitest'
import { CursorNotTerminated, walkCursor } from '../../shared/utils/cursor'

/** A server that hands out `pages` in order, then reports no more. */
function paged<T>(pages: { data: T[], nextCursor: string | null }[]) {
  const calls: (string | null)[] = []
  const fetchPage = vi.fn(async (cursor: string | null) => {
    calls.push(cursor)
    const i = cursor === null ? 0 : pages.findIndex(p => p.nextCursor === cursor) + 1
    return pages[i] ?? { data: [], nextCursor: null }
  })
  return { fetchPage, calls }
}

describe('walkCursor', () => {
  it('starts with no cursor and passes each next one back', async () => {
    const { fetchPage, calls } = paged([
      { data: [{ id: 'a' }], nextCursor: 'c1' },
      { data: [{ id: 'b' }], nextCursor: null }
    ])

    expect(await walkCursor(fetchPage)).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(calls).toEqual([null, 'c1'])
  })

  it('stops at the first page when there is nothing after it', async () => {
    const { fetchPage } = paged([{ data: [{ id: 'a' }], nextCursor: null }])

    await walkCursor(fetchPage)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('gives up on a cursor that never advances, instead of looping to the cap', async () => {
    // what the Postman mock does: one static page, same next_cursor forever
    const fetchPage = vi.fn(async () => ({ data: [{ id: 'a' }, { id: 'b' }], nextCursor: 'stuck' }))

    expect(await walkCursor(fetchPage, 20)).toEqual([{ id: 'a' }, { id: 'b' }])
    // once to read it, once more to learn the cursor repeats — not 20 times
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('keeps each id once when pages overlap', async () => {
    // a cursor walk over a list being written to can repeat a row
    const { fetchPage } = paged([
      { data: [{ id: 'a' }, { id: 'b' }], nextCursor: 'c1' },
      { data: [{ id: 'b' }, { id: 'c' }], nextCursor: null }
    ])

    expect(await walkCursor(fetchPage)).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
  })

  it('keeps rows that have no id at all', async () => {
    const { fetchPage } = paged([{ data: [{ n: 1 }, { n: 2 }], nextCursor: null }])
    expect(await walkCursor(fetchPage)).toEqual([{ n: 1 }, { n: 2 }])
  })

  it('throws rather than returning a list it knows is incomplete', async () => {
    // every page advances, so the repeat guard never fires and the cap is hit
    let n = 0
    const fetchPage = vi.fn(async () => ({ data: [{ id: `r${n}` }], nextCursor: `c${n++}` }))

    await expect(walkCursor(fetchPage, 3)).rejects.toBeInstanceOf(CursorNotTerminated)
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('names the page count in the error, so the cap is findable', async () => {
    let n = 0
    const fetchPage = async () => ({ data: [{ id: `r${n}` }], nextCursor: `c${n++}` })

    await expect(walkCursor(fetchPage, 5)).rejects.toThrow('after 5')
  })
})
