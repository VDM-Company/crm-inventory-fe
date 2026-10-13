import { describe, expect, it } from 'vitest'
import {
  diffAttributeOptions,
  inputTypeLabel,
  labelToInputType,
  toAttributeDef,
  toAttributeDefs
} from '../../shared/utils/attribute-def'
import type { Attribute, AttributeOption } from '../../shared/types/vertex'

const option = (id: string, label: string, extra: Partial<AttributeOption> = {}): AttributeOption => ({
  id,
  label: { en: label },
  swatchType: null,
  swatchValue: null,
  swatchUrl: null,
  sortOrder: 1,
  used: false,
  usageCount: 0,
  ...extra
})

const attribute = (extra: Partial<Attribute> = {}): Attribute => ({
  id: 'a1',
  code: 'data',
  label: { en: 'Data' },
  inputType: 'dropdown',
  isFilterable: true,
  canBeVariantAxis: true,
  options: [option('o1', '15GB'), option('o2', '30GB')],
  sortOrder: 1,
  usageCount: 3,
  lockVersion: 2,
  ...extra
})

describe('toAttributeDef', () => {
  it('flattens to the shape the product forms read', () => {
    expect(toAttributeDef(attribute())).toEqual({
      id: 'a1', name: 'Data', type: 'Dropdown', values: ['15GB', '30GB']
    })
  })

  it('keeps the option order the API sent', () => {
    const a = attribute({ options: [option('o2', '30GB'), option('o1', '15GB')] })
    expect(toAttributeDef(a).values).toEqual(['30GB', '15GB'])
  })

  it('resolves the locale on both the label and the options', () => {
    const a = attribute({
      label: { en: 'Data', ja: 'データ' },
      options: [option('o1', '15GB', { label: { en: '15GB', ja: '15ギガ' } })]
    })
    const def = toAttributeDef(a, 'ja')
    expect(def.name).toBe('データ')
    expect(def.values).toEqual(['15ギガ'])
  })

  it('gives a text attribute an empty value list rather than undefined', () => {
    expect(toAttributeDef(attribute({ inputType: 'text', options: [] })).values).toEqual([])
  })

  it('maps every input type the API defines', () => {
    expect(inputTypeLabel('dropdown')).toBe('Dropdown')
    expect(inputTypeLabel('swatch')).toBe('Swatch')
    expect(inputTypeLabel('radio')).toBe('Radio')
    expect(inputTypeLabel('text')).toBe('Text')
  })

  it('shows an unknown type as itself rather than guessing', () => {
    // the API may add one; showing the raw value beats silently calling it a
    // dropdown in the UI
    expect(inputTypeLabel('slider')).toBe('slider')
  })

  it('round-trips a label back to the API value', () => {
    for (const t of ['dropdown', 'swatch', 'radio', 'text'] as const) {
      expect(labelToInputType(inputTypeLabel(t))).toBe(t)
    }
  })

  it('maps a list', () => {
    expect(toAttributeDefs([attribute(), attribute({ id: 'a2', label: { en: 'Color' } })]).map(d => d.name))
      .toEqual(['Data', 'Color'])
  })
})

describe('diffAttributeOptions', () => {
  const saved = [option('o1', '15GB'), option('o2', '30GB'), option('o3', 'Unlimited')]

  it('finds nothing when the rows match', () => {
    const rows = saved.map(o => ({ id: o.id, label: o.label.en! }))
    expect(diffAttributeOptions(saved, rows)).toEqual({ removedIds: [], renamed: [] })
  })

  it('reports an option the form dropped', () => {
    const rows = [{ id: 'o1', label: '15GB' }, { id: 'o3', label: 'Unlimited' }]
    expect(diffAttributeOptions(saved, rows).removedIds).toEqual(['o2'])
  })

  it('tells a rename apart from a delete plus an add', () => {
    // the whole reason the rows carry ids: a rename keeps every product that
    // chose the option, a delete-and-add does not
    const rows = [{ id: 'o1', label: '20GB' }, { id: 'o2', label: '30GB' }, { id: 'o3', label: 'Unlimited' }]
    const diff = diffAttributeOptions(saved, rows)

    expect(diff.renamed).toEqual([{ id: 'o1', label: '20GB' }])
    expect(diff.removedIds).toEqual([])
  })

  it('does not treat a new row as a rename of anything', () => {
    const rows = [...saved.map(o => ({ id: o.id, label: o.label.en! })), { id: null, label: '50GB' }]
    const diff = diffAttributeOptions(saved, rows)

    expect(diff.renamed).toEqual([])
    expect(diff.removedIds).toEqual([])
  })

  it('handles the form being cleared entirely', () => {
    expect(diffAttributeOptions(saved, []).removedIds).toEqual(['o1', 'o2', 'o3'])
  })

  it('handles an attribute that had no options', () => {
    expect(diffAttributeOptions([], [{ id: null, label: 'First' }]))
      .toEqual({ removedIds: [], renamed: [] })
  })

  it('compares against the right locale', () => {
    const ja = [option('o1', '15GB', { label: { en: '15GB', ja: '15ギガ' } })]
    // unchanged in Japanese, so nothing to rename
    expect(diffAttributeOptions(ja, [{ id: 'o1', label: '15ギガ' }], 'ja').renamed).toEqual([])
    // but the English label differs from what the form holds
    expect(diffAttributeOptions(ja, [{ id: 'o1', label: '15ギガ' }], 'en').renamed).toHaveLength(1)
  })
})
