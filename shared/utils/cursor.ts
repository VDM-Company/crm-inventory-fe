/** One page of a cursor-paginated list, as far as the walk is concerned. */
export interface CursorPage<T> {
  data: T[]
  nextCursor: string | null
}

export class CursorNotTerminated extends Error {
  constructor(readonly pages: number) {
    super(`The list still reported more pages after ${pages}. Either it is not master data, or the cursor is broken.`)
    this.name = 'CursorNotTerminated'
  }
}

/**
 * Walk a cursor-paginated list to the end and return every row.
 *
 * Pure: it is handed a `fetchPage`, so it can be tested without a server and
 * reused by any resource whose full list a screen renders.
 *
 * Three things it guarantees, each of which a real list got wrong:
 *
 * - **Each id once.** A cursor walk over a list that is being written to can
 *   hand back a row an earlier page already carried. The Postman mock does it
 *   unconditionally: it replays one static page forever, which turned a naive
 *   walk into 60 rows that were the same 3 over and over.
 * - **A cursor that stops advancing ends the walk** rather than spinning to
 *   the page cap.
 * - **Running out of pages throws.** Silently returning a truncated list is
 *   the failure that looks like missing data much later.
 */
export async function walkCursor<T>(
  fetchPage: (cursor: string | null) => Promise<CursorPage<T>>,
  maxPages = 20
): Promise<T[]> {
  const rows: T[] = []
  const seen = new Set<string>()
  let cursor: string | null = null

  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor)

    for (const row of page.data) {
      const id = (row as { id?: string })?.id
      if (id === undefined) {
        rows.push(row)
        continue
      }
      if (seen.has(id)) continue
      seen.add(id)
      rows.push(row)
    }

    const next = page.nextCursor
    if (!next || next === cursor) return rows
    cursor = next
  }

  throw new CursorNotTerminated(maxPages)
}
