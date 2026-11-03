import { describe, expect, it } from 'vitest'
import { cancelWarning, isCancellable, scheduledRows } from '../../shared/utils/scheduled-plans'
import type { PricePlan, PricingScope } from '../../shared/types/vertex'

const BASE = 'fee_base'
const TAX = 'fee_tax'

const line = (feeItemId: string | null, amount: number, extra: Record<string, unknown> = {}) => ({
  id: 'l_' + (feeItemId ?? 'm'),
  lineType: feeItemId ? 'fee' : 'monthly',
  feeItemId,
  bundleSelectionId: null,
  amount,
  amountMonthly: null,
  isPublished: true,
  sortOrder: 0,
  feeCode: null,
  feeName: null,
  feeKind: null,
  ...extra
})

const plan = (over: Partial<PricePlan> = {}): PricePlan => ({
  id: 'p1',
  productId: 'prod1',
  scope: 'default',
  status: 'scheduled',
  effectiveAt: '2026-11-30T15:00:00.000Z',
  applyToExisting: false,
  noticeSentAt: null,
  existingEffectiveFrom: null,
  lines: [line(BASE, 3300), line(TAX, 330)],
  ...over
}) as PricePlan

const scope = (plans: PricePlan[]): PricingScope => ({
  scope: 'default',
  mode: 'own',
  source: 'default',
  activePlan: null,
  scheduledPlans: plans
}) as PricingScope

describe('scheduledRows', () => {
  it('summarises a plan the way the card reads it', () => {
    expect(scheduledRows(scope([plan()]))).toEqual([{
      id: 'p1',
      effectiveAt: '2026-11-30T15:00:00.000Z',
      monthly: '',
      initialTotal: 3630,
      noticeSent: false
    }])
  })

  it('reads the recurring price out of the monthly line', () => {
    const withMonthly = plan({
      lines: [line(BASE, 0), line(null, 0, { lineType: 'monthly', amountMonthly: 2980 })]
    })
    expect(scheduledRows(scope([withMonthly]))[0]).toMatchObject({ monthly: '2980', initialTotal: 0 })
  })

  it('leaves an unpublished line out of the initial total', () => {
    // the total is what the customer is shown, which is the published lines
    const mixed = plan({ lines: [line(BASE, 3300), line(TAX, 330, { isPublished: false })] })
    expect(scheduledRows(scope([mixed]))[0]!.initialTotal).toBe(3300)
  })

  it('shows the soonest first, whatever order they arrive in', () => {
    // these switch over in time order, and a list out of order invites
    // cancelling the wrong one
    const rows = scheduledRows(scope([
      plan({ id: 'late', effectiveAt: '2026-12-31T00:00:00.000Z' }),
      plan({ id: 'soon', effectiveAt: '2026-11-01T00:00:00.000Z' })
    ]))
    expect(rows.map(r => r.id)).toEqual(['soon', 'late'])
  })

  it('puts a plan with no date last rather than first', () => {
    const rows = scheduledRows(scope([
      plan({ id: 'undated', effectiveAt: null }),
      plan({ id: 'dated', effectiveAt: '2026-11-01T00:00:00.000Z' })
    ]))
    expect(rows.map(r => r.id)).toEqual(['dated', 'undated'])
  })

  it('ignores a plan that is no longer scheduled', () => {
    // a cancelled or superseded one is history, not something to act on
    const rows = scheduledRows(scope([
      plan({ id: 'cancelled', status: 'cancelled' }),
      plan({ id: 'live', status: 'scheduled' })
    ]))
    expect(rows.map(r => r.id)).toEqual(['live'])
  })

  it('reports whether subscribers have been told', () => {
    expect(scheduledRows(scope([plan({ noticeSentAt: '2026-11-01T00:00:00.000Z' })]))[0]!.noticeSent).toBe(true)
  })

  it('survives a scope with nothing scheduled', () => {
    expect(scheduledRows(scope([]))).toEqual([])
    expect(scheduledRows(null)).toEqual([])
  })
})

describe('isCancellable', () => {
  it('is true only for a scheduled plan', () => {
    // 409 `invalid_transition` for anything else
    expect(isCancellable(plan())).toBe(true)
    expect(isCancellable(plan({ status: 'active' }))).toBe(false)
    expect(isCancellable(plan({ status: 'superseded' }))).toBe(false)
    expect(isCancellable(plan({ status: 'cancelled' }))).toBe(false)
    expect(isCancellable(null)).toBe(false)
  })
})

describe('cancelWarning', () => {
  it('warns when the change has already been announced', () => {
    const [row] = scheduledRows(scope([plan({ noticeSentAt: '2026-11-01T00:00:00.000Z' })]))
    expect(cancelWarning(row)).toContain('already been told')
  })

  it('says nothing when it has not', () => {
    const [row] = scheduledRows(scope([plan()]))
    expect(cancelWarning(row)).toBeNull()
    expect(cancelWarning(null)).toBeNull()
  })
})
