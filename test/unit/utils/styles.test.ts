import { describe, expect, it } from 'vitest'
import { tableUi } from '../../../app/utils/table'
import { fieldCompact, fieldCompactSm, fieldUi } from '../../../app/utils/field'

// These builders exist because of two cascade rules that bit this app before:
// Tailwind's scanner only sees literal class strings, and a per-call `:ui`
// has to out-rank Nuxt UI's own size variants.
describe('tableUi', () => {
  it('returns the shared table slots', () => {
    const ui = tableUi()
    expect(ui.base).toBe('w-full border-collapse')
    expect(ui.th).toContain('font-bold')
    expect(ui.th).toContain('text-slate-500')
  })

  it('appends a caller class without leaving a stray space', () => {
    expect(tableUi('min-w-[640px]').base).toBe('w-full border-collapse min-w-[640px]')
    expect(tableUi().base.endsWith(' ')).toBe(false)
  })

  it('keeps spelling the header colour out, so it beats UTable own utilities', () => {
    // `.th` alone would lose: it lives in the components layer and UTable sets
    // `font-semibold text-highlighted` as utilities
    expect(tableUi().th).toMatch(/font-bold.*text-slate-500|text-slate-500.*font-bold/)
  })
})

describe('field presets', () => {
  it('pins a line height on the compact scales', () => {
    // inherited line height differs inside UFormField, which made the same
    // field 1px shorter there than beside it
    expect(fieldCompact().base).toContain('text-[14px]/[21px]')
    expect(fieldCompactSm().base).toContain('text-[13px]/[19.5px]')
  })

  it('re-asserts the size at the md breakpoint to beat the iOS zoom guard', () => {
    expect(fieldCompact().base).toContain('md:text-[14px]/[21px]')
    expect(fieldCompactSm().base).toContain('md:text-[13px]/[19.5px]')
  })

  it('appends caller classes and trims', () => {
    expect(fieldCompact('pl-[26px]').base).toContain('pl-[26px]')
    expect(fieldCompact().base.endsWith(' ')).toBe(false)
  })

  it('fieldUi passes a class straight through for the standard scale', () => {
    expect(fieldUi('font-mono')).toEqual({ base: 'font-mono' })
  })
})
