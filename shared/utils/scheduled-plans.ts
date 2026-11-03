import type { PricePlan, PricingScope } from '#shared/types'
import { linesToComponents, monthlyFromLines } from './variant-pricing'

/**
 * Price changes that have not taken effect yet.
 *
 * `pricing()` has reported these all along — `PricingScope.scheduledPlans` —
 * and nothing on screen read them. A price could be waiting to switch over
 * on a date nobody could see, and the only way to stop it was outside this
 * app.
 *
 * Creating one is still not possible here: every `createPricePlan` call
 * sends `effectiveAt: null`, which means "now". So this shows and cancels
 * what something else scheduled.
 */

/** One row of the scheduled list. */
export interface ScheduledPlanRow {
  id: string
  /** ISO, as the API sends it; the screen formats it. */
  effectiveAt: string | null
  /** Recurring price, or '' when the plan has no monthly line. */
  monthly: string
  /** Sum of the published fee lines, in integer JPY. */
  initialTotal: number
  /** True when the API has already told subscribers it is coming. */
  noticeSent: boolean
}

/**
 * The scheduled plans of one scope, soonest first.
 *
 * Sorted rather than trusted in order: they switch over in time order, and a
 * list that reads out of order invites cancelling the wrong one.
 */
export function scheduledRows(scope: PricingScope | null | undefined): ScheduledPlanRow[] {
  return (scope?.scheduledPlans || [])
    .filter(p => p.status === 'scheduled')
    .map(toRow)
    .sort((a, b) => {
      // a plan with no date cannot be placed, so it goes last rather than
      // sorting as the epoch and claiming to be first
      const ta = a.effectiveAt ? Date.parse(a.effectiveAt) : Number.POSITIVE_INFINITY
      const tb = b.effectiveAt ? Date.parse(b.effectiveAt) : Number.POSITIVE_INFINITY
      return ta - tb
    })
}

function toRow(plan: PricePlan): ScheduledPlanRow {
  return {
    id: plan.id,
    effectiveAt: plan.effectiveAt,
    monthly: monthlyFromLines(plan.lines),
    initialTotal: linesToComponents(plan.lines)
      .filter(c => c.isPublished !== false)
      .reduce((total, c) => total + (Number(c.amount) || 0), 0),
    noticeSent: !!plan.noticeSentAt
  }
}

/**
 * Whether this plan can still be cancelled.
 *
 * Only `scheduled` — the API answers 409 `invalid_transition` for anything
 * else, because a price already in force is history rather than a plan.
 */
export const isCancellable = (plan: PricePlan | null | undefined) => plan?.status === 'scheduled'

/**
 * What cancelling this one costs, said plainly.
 *
 * A plan whose notice has gone out is the case worth pausing on: subscribers
 * have been told the price is changing, and cancelling it means that message
 * was wrong.
 */
export function cancelWarning(row: ScheduledPlanRow | null | undefined): string | null {
  if (!row) return null
  return row.noticeSent
    ? 'Subscribers have already been told about this change. Cancelling it means they were told something that will not happen.'
    : null
}
