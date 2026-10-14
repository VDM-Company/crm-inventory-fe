import type { CatalogStats } from '#shared/types'

/**
 * The four counters on the dashboard.
 *
 * They were hard-coded — `148 / 121 / 34 / 9` — and showed those numbers
 * whatever the catalogue held. This maps the real document onto them.
 *
 * It is a pure function with tests because the mistakes it can make are
 * silent: a wrong bucket name reads as zero, not as an error, and a wrong
 * denominator just prints a plausible percentage. Nothing downstream would
 * notice.
 */

/** One tile, in the shape the screen already renders. */
export interface DashStatValues {
  total: number
  active: number
  withVariants: number
  lowStock: number
  createdThisMonth: number
  variantsCreatedThisMonth: number
  /** Share of the catalogue that is active, already rounded. */
  activePercent: number
}

const sum = (counts: Record<string, number> | undefined) =>
  Object.values(counts || {}).reduce((t, n) => t + (Number(n) || 0), 0)

/**
 * `trashed` is excluded from the total.
 *
 * A soft-deleted product is not in the catalogue any more, and counting it
 * would make "Total" disagree with every list on the screen — those filter it
 * out. `draft`, `active` and `inactive` all stay: they are all things that
 * exist and that someone has to deal with.
 */
export function toDashStatValues(stats: CatalogStats | null | undefined): DashStatValues {
  const byStatus = stats?.productsByStatus || {}
  const byType = stats?.productsByType || {}

  const trashed = Number(byStatus.trashed) || 0
  const total = Math.max(sum(byStatus) - trashed, 0)
  const active = Number(byStatus.active) || 0

  /*
   * `variant`, not `configurable`.
   *
   * This endpoint buckets types as `single | variant | bundle` while every
   * product endpoint says `simple | configurable | bundle`. Two of the three
   * words differ. Reading `configurable` here would quietly always be zero,
   * so both spellings are accepted until the API's author confirms which is
   * intended.
   */
  const variantsOf = (counts: Record<string, number>) =>
    (Number(counts.variant) || 0) + (Number(counts.configurable) || 0)

  return {
    total,
    active,
    withVariants: variantsOf(byType),
    lowStock: Number(stats?.outOfStockProducts) || 0,
    createdThisMonth: Number(stats?.createdThisMonth) || 0,
    variantsCreatedThisMonth: variantsOf(stats?.createdThisMonthByType || {}),
    // an empty catalogue is 0%, not NaN%
    activePercent: total > 0 ? Math.round((active / total) * 100) : 0
  }
}

/** `+12 this month`, or nothing at all when the month has added nothing. */
export const thisMonthLabel = (n: number) => n > 0 ? `+${n} this month` : 'None this month'
