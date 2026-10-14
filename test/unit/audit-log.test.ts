import { describe, expect, it } from 'vitest'
import {
  actionLabel,
  diffSnapshots,
  fieldLabel,
  formatValue,
  toHistoryEntries
} from '../../shared/utils/audit-log'
import type { AuditLogEntry } from '../../shared/types/vertex'

const entry = (over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: 'a1',
  actor: { type: 'user', id: 'u1', name: 'Hana Sato' },
  module: 'catalog',
  entityType: 'product',
  entityId: 'p1',
  entityLabel: 'Tourist SIM 15GB',
  subject: { type: 'product', id: 'p1' },
  action: 'updated',
  changes: { before: {}, after: {} },
  ip: null,
  createdAt: '2026-10-07T14:33:15.316Z',
  ...over
})

describe('diffSnapshots', () => {
  it('reports only what moved', () => {
    // the collection's own `updated` example carries fourteen keys of which
    // exactly one changed; listing them all would bury it
    const before = {
      sku: 'TSIM-15GB', status: 'active', isGift: false,
      platformIds: ['p_a', 'p_b', 'p_c']
    }
    const after = {
      sku: 'TSIM-15GB', status: 'active', isGift: false,
      platformIds: ['p_a', 'p_b']
    }
    // both sides are rendered the same way, so they can be compared
    expect(diffSnapshots(before, after)).toEqual([
      { field: 'Platforms', from: 'p_a, p_b, p_c', to: 'p_a, p_b' }
    ])
  })

  it('takes the union of both sides, because before is often partial', () => {
    // the platform-content example has one key in `before` and four in `after`
    const changes = diffSnapshots({ platformId: 'pf1' }, { platformId: 'pf1', name: { en: 'New' } })
    expect(changes).toEqual([{ field: 'Name', from: '—', to: 'New' }])
  })

  it('is empty when nothing moved', () => {
    expect(diffSnapshots({ sku: 'A' }, { sku: 'A' })).toEqual([])
  })

  it('treats a missing key and a null as the same absence', () => {
    expect(diffSnapshots({ notes: null }, {})).toEqual([])
  })

  it('survives null snapshots', () => {
    expect(diffSnapshots(null, null)).toEqual([])
    expect(diffSnapshots(undefined, { sku: 'A' })).toEqual([{ field: 'SKU', from: '—', to: 'A' }])
  })

  it('does not depend on key order', () => {
    expect(diffSnapshots({ a: 1, b: 2 }, { b: 2, a: 9 })).toEqual([{ field: 'A', from: '1', to: '9' }])
  })
})

describe('formatValue', () => {
  it('reads booleans as words, not true/false', () => {
    expect(formatValue(true)).toBe('Yes')
    expect(formatValue(false)).toBe('No')
  })

  it('shows an absence as a dash rather than "null"', () => {
    expect(formatValue(null)).toBe('—')
    expect(formatValue(undefined)).toBe('—')
    expect(formatValue('')).toBe('—')
  })

  it('takes the text out of a localized map', () => {
    expect(formatValue({ en: 'Japan Tourist SIM 15GB' })).toBe('Japan Tourist SIM 15GB')
  })

  it('counts a list of records instead of printing it', () => {
    expect(formatValue([{ path: 'x' }, { path: 'y' }])).toBe('2 items')
    expect(formatValue([])).toBe('none')
  })

  it('joins plain values that are readable', () => {
    expect(formatValue(['a', 'b', 'c'])).toBe('a, b, c')
  })

  it('does not dump a nested record', () => {
    expect(formatValue({ path: 'x', role: 'base', sortOrder: 1 })).toBe('3 fields')
  })

  it('keeps 0 and false rather than reading them as absent', () => {
    expect(formatValue(0)).toBe('0')
    expect(formatValue(false)).toBe('No')
  })
})

describe('fieldLabel', () => {
  it('uses the screen’s own words where they differ', () => {
    expect(fieldLabel('sku')).toBe('SKU')
    expect(fieldLabel('isGift')).toBe('Not for sale')
    expect(fieldLabel('stockStatus')).toBe('Stock')
    expect(fieldLabel('platformIds')).toBe('Platforms')
  })

  it('humanises anything it has no word for', () => {
    expect(fieldLabel('notes')).toBe('Notes')
    expect(fieldLabel('someNewField')).toBe('Some new field')
  })
})

describe('actionLabel', () => {
  it('reads an action as a sentence', () => {
    expect(actionLabel('product_platform_content_updated')).toBe('Platform content updated')
    expect(actionLabel('created')).toBe('Created')
  })

  it('does not render an empty label', () => {
    expect(actionLabel('')).toBe('Changed')
  })
})

describe('toHistoryEntries', () => {
  it('maps an entry onto the drawer’s shape', () => {
    const [e] = toHistoryEntries([entry({
      changes: { before: { sku: 'OLD' }, after: { sku: 'NEW' } }
    })])
    expect(e).toEqual({
      id: 'a1',
      actor: 'Hana Sato',
      ts: Date.parse('2026-10-07T14:33:15.316Z'),
      changes: [{ field: 'SKU', from: 'OLD', to: 'NEW' }]
    })
  })

  it('still shows an entry whose snapshots differ in nothing', () => {
    // it happened; a blank row would be worse than saying what it was
    const [e] = toHistoryEntries([entry({ action: 'created', changes: null })])
    expect(e!.changes).toEqual([{ field: 'Created', from: '', to: '' }])
  })

  it('names a system actor rather than printing nothing', () => {
    const [e] = toHistoryEntries([entry({ actor: { type: 'system', id: null, name: null } })])
    expect(e!.actor).toBe('System')
  })

  it('falls back to Unknown for an actor it cannot name', () => {
    const [e] = toHistoryEntries([entry({ actor: { type: 'token', id: null, name: null } })])
    expect(e!.actor).toBe('Unknown')
  })

  it('does not produce NaN from an unparseable timestamp', () => {
    const [e] = toHistoryEntries([entry({ createdAt: 'not a date' })])
    expect(e!.ts).toBe(0)
  })

  it('handles an empty log', () => {
    expect(toHistoryEntries([])).toEqual([])
    expect(toHistoryEntries(null)).toEqual([])
  })
})

// ── ids ─────────────────────────────────────────────────────────────────────
// A UUID on screen tells the reader nothing, and the first version of this
// printed them on one side of a change while the other side said "3 items" —
// two halves of a comparison that could not be compared.

const PF_A = '01a116c8-5d68-7007-a79d-4f65f606f29c'
const PF_B = '01a116c8-5d82-73e5-9f80-a0e0cc8d42c5'
const PF_C = '01a116c8-5da4-701e-b27e-4f7957b9338d'

describe('formatValue, ids', () => {
  it('never prints a raw uuid', () => {
    expect(formatValue(PF_A)).toBe('an item')
    expect(formatValue([PF_A, PF_B])).toBe('2 items')
  })

  it('names them when the caller can resolve every one', () => {
    const names: Record<string, string> = { [PF_A]: 'SK SIM', [PF_B]: 'SIM Point' }
    expect(formatValue([PF_A, PF_B], id => names[id])).toBe('SK SIM, SIM Point')
    expect(formatValue(PF_A, id => names[id])).toBe('SK SIM')
  })

  it('falls back to a count when only some resolve', () => {
    // a half-named list reads as though the unnamed one does not exist
    const names: Record<string, string> = { [PF_A]: 'SK SIM' }
    expect(formatValue([PF_A, PF_B], id => names[id])).toBe('2 items')
  })

  it('compares like with like on both sides of a change', () => {
    const names: Record<string, string> = { [PF_A]: 'SK SIM', [PF_B]: 'SIM Point', [PF_C]: 'Old Store' }
    expect(diffSnapshots({ platformIds: [PF_A, PF_B, PF_C] }, { platformIds: [PF_A, PF_B] }, id => names[id]))
      .toEqual([{ field: 'Platforms', from: 'SK SIM, SIM Point, Old Store', to: 'SK SIM, SIM Point' }])
  })

  it('still compares like with like without a resolver', () => {
    expect(diffSnapshots({ platformIds: [PF_A, PF_B, PF_C] }, { platformIds: [PF_A, PF_B] }))
      .toEqual([{ field: 'Platforms', from: '3 items', to: '2 items' }])
  })
})
