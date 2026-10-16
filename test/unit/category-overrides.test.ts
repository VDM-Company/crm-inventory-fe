import { describe, expect, it } from 'vitest'
import {
  categoryContentPatch,
  categoryDefaultPatch,
  categoryDraftFor
} from '../../shared/utils/category-overrides'
import type { CategoryDraft } from '../../shared/utils/category-overrides'
import type { VertexCategory } from '../../shared/types/vertex'

const category = (over: Partial<VertexCategory> = {}): VertexCategory => ({
  id: 'c1',
  parentId: null,
  name: { en: 'SIM Cards' },
  path: 'SIM Cards',
  isEnabled: true,
  includeInMenu: true,
  productSort: 'position',
  sortOrder: 0,
  productCount: 0,
  lockVersion: 1,
  platform: null,
  children: [],
  ...over
})

const platformView = (over: Record<string, unknown> = {}) => ({
  name: { value: { en: 'Travel SIM Cards' }, source: 'platform' },
  isEnabled: { value: true, source: 'default' },
  includeInMenu: { value: true, source: 'default' },
  productSort: { value: 'position', source: 'default' },
  sortOrder: { value: 0, source: 'default' },
  disabledByAncestor: false,
  productsCustomOrder: false,
  lockVersion: 2,
  ...over
}) as VertexCategory['platform']

const draft = (over: Partial<CategoryDraft> = {}): CategoryDraft => ({
  name: 'SIM Cards',
  isEnabled: true,
  nameOverridden: false,
  enabledOverridden: false,
  ...over
})

describe('categoryDraftFor', () => {
  it('shows the Default values on the Default scope', () => {
    expect(categoryDraftFor(category(), false)).toEqual({
      name: 'SIM Cards', isEnabled: true, nameOverridden: false, enabledOverridden: false
    })
  })

  it('shows the PLATFORM’s name on a platform scope, not the Default one', () => {
    // the bug this exists for: the field showed `SIM Cards` under "SIM Point"
    // however that platform had renamed it
    expect(categoryDraftFor(category({ platform: platformView() }), true)).toEqual({
      name: 'Travel SIM Cards', isEnabled: true, nameOverridden: true, enabledOverridden: false
    })
  })

  it('reports a field as inherited when the platform has not claimed it', () => {
    const d = categoryDraftFor(category({ platform: platformView() }), true)
    expect(d.nameOverridden).toBe(true)
    expect(d.enabledOverridden).toBe(false)
  })

  it('reports an inherited name as NOT overridden', () => {
    // the mutation that always claimed `platform` showed every field as
    // overridden, which would badge an inherited value "Overridden"
    const inherited = platformView({ name: { value: { en: 'SIM Cards' }, source: 'default' } })
    const d = categoryDraftFor(category({ platform: inherited }), true)
    expect(d.nameOverridden).toBe(false)
    expect(d.name).toBe('SIM Cards')
  })

  it('ignores the platform view entirely on the Default scope', () => {
    // the record carries it whenever the tree was fetched with a platformId,
    // so the scope — not its presence — decides which values are shown
    const d = categoryDraftFor(category({ platform: platformView() }), false)
    expect(d).toEqual({ name: 'SIM Cards', isEnabled: true, nameOverridden: false, enabledOverridden: false })
  })

  it('falls back to Default when the tree was fetched without a platform', () => {
    // `platform` is null unless the request passed `platformId`
    expect(categoryDraftFor(category({ platform: null }), true).name).toBe('SIM Cards')
  })

  it('survives no category at all', () => {
    expect(categoryDraftFor(null, true)).toEqual({
      name: '', isEnabled: true, nameOverridden: false, enabledOverridden: false
    })
  })
})

describe('categoryContentPatch', () => {
  const savedOverridden = draft({ name: 'Travel SIM Cards', nameOverridden: true })

  it('sends a name this platform now claims', () => {
    expect(categoryContentPatch(draft(), draft({ name: 'Travel SIM', nameOverridden: true })))
      .toEqual({ name: { en: 'Travel SIM' } })
  })

  it('RESETS a name the platform no longer claims', () => {
    // without this the platform keeps the old override for good
    expect(categoryContentPatch(savedOverridden, draft({ name: 'Travel SIM Cards' })))
      .toEqual({ reset: ['name'] })
  })

  it('is null when the override did not move', () => {
    expect(categoryContentPatch(savedOverridden, { ...savedOverridden })).toBeNull()
    expect(categoryContentPatch(draft(), draft())).toBeNull()
  })

  it('does not send a blank name, which the API refuses anyway', () => {
    // 422 `name.en` required; dropping an override is the explicit reset,
    // not an empty field
    expect(categoryContentPatch(draft(), draft({ name: '   ', nameOverridden: true }))).toBeNull()
  })

  it('handles the enabled flag in both directions', () => {
    expect(categoryContentPatch(draft(), draft({ isEnabled: false, enabledOverridden: true })))
      .toEqual({ isEnabled: false })
    expect(categoryContentPatch(draft({ isEnabled: false, enabledOverridden: true }), draft({ isEnabled: false })))
      .toEqual({ reset: ['isEnabled'] })
  })

  it('carries an override and a reset in one patch', () => {
    const saved = draft({ name: 'Travel', nameOverridden: true, isEnabled: false, enabledOverridden: true })
    const next = draft({ name: 'Travel', nameOverridden: true, isEnabled: true })
    // name stays claimed and unchanged, enabled goes back to Default
    expect(categoryContentPatch(saved, next)).toEqual({ reset: ['isEnabled'] })
  })

  it('sends a value the platform claims even when it equals Default', () => {
    // the API stores a platform value equal to Default, deliberately
    const next = draft({ name: 'SIM Cards', nameOverridden: true })
    expect(categoryContentPatch(draft(), next)).toEqual({ name: { en: 'SIM Cards' } })
  })
})

describe('categoryDefaultPatch', () => {
  it('sends only what changed', () => {
    expect(categoryDefaultPatch(category(), draft({ name: 'SIM' }))).toEqual({ name: { en: 'SIM' } })
    expect(categoryDefaultPatch(category(), draft({ isEnabled: false }))).toEqual({ isEnabled: false })
  })

  it('is null when nothing changed', () => {
    expect(categoryDefaultPatch(category(), draft())).toBeNull()
  })

  it('refuses to blank a name', () => {
    expect(categoryDefaultPatch(category(), draft({ name: '  ' }))).toBeNull()
  })

  it('is null without a category', () => {
    expect(categoryDefaultPatch(null, draft({ name: 'X' }))).toBeNull()
  })
})
