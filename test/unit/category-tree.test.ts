import { describe, expect, it } from 'vitest'
import { flattenVertexTree, indexVertexTree } from '../../shared/utils/category-tree'
import type { VertexCategory } from '../../shared/types/vertex'

const node = (id: string, name: string, parentId: string | null, children: VertexCategory[] = [], extra: Partial<VertexCategory> = {}) => ({
  id,
  parentId,
  name: { en: name },
  path: name,
  isEnabled: true,
  includeInMenu: true,
  productSort: 'position',
  sortOrder: 1,
  productCount: 0,
  lockVersion: 0,
  platform: null,
  children,
  ...extra
} as VertexCategory)

const tree: VertexCategory[] = [
  node('sim', 'SIM Cards', null, [
    node('tourist', 'Tourist SIM', 'sim'),
    node('esim', 'eSIM', 'sim')
  ]),
  node('wifi', 'Pocket WiFi', null),
  node('acc', 'Accessories', null, [], { isEnabled: false })
]

describe('flattenVertexTree', () => {
  it('reaches every node, not just the roots', () => {
    expect(flattenVertexTree(tree).map(c => c.id)).toEqual(['sim', 'tourist', 'esim', 'wifi', 'acc'])
  })

  it('keeps the API order depth-first, because the helpers read order as sibling order', () => {
    // breadth-first would give sim, wifi, acc, tourist, esim — a different tree
    const ids = flattenVertexTree(tree).map(c => c.id)
    expect(ids.indexOf('tourist')).toBe(ids.indexOf('sim') + 1)
    expect(ids.indexOf('wifi')).toBeGreaterThan(ids.indexOf('esim'))
  })

  it('resolves the localized name to a string', () => {
    expect(flattenVertexTree(tree)[0]!.name).toBe('SIM Cards')
  })

  it('honours the requested locale and falls back when it is missing', () => {
    const ja = [node('sim', 'SIM Cards', null, [], { name: { en: 'SIM Cards', ja: 'SIMカード' } })]
    expect(flattenVertexTree(ja, 'ja')[0]!.name).toBe('SIMカード')
    expect(flattenVertexTree(ja, 'de')[0]!.name).toBe('SIM Cards')
  })

  it('carries parentId so the helpers can rebuild the hierarchy', () => {
    const flat = flattenVertexTree(tree)
    expect(flat.find(c => c.id === 'tourist')!.parentId).toBe('sim')
    expect(flat.find(c => c.id === 'sim')!.parentId).toBeNull()
  })

  it('maps isEnabled onto enabled, false included', () => {
    const flat = flattenVertexTree(tree)
    expect(flat.find(c => c.id === 'acc')!.enabled).toBe(false)
    expect(flat.find(c => c.id === 'sim')!.enabled).toBe(true)
  })

  it('treats a missing isEnabled as enabled, not disabled', () => {
    // the old shape's rule, which the screens still apply: absent means on.
    // Reading it as `!!n.isEnabled` would grey out every row the API sent
    // without the flag.
    const bare = [{ id: 'x', parentId: null, name: { en: 'X' } } as VertexCategory]
    expect(flattenVertexTree(bare)[0]!.enabled).toBe(true)
  })

  it('survives a node with no children array at all', () => {
    expect(flattenVertexTree([{ id: 'x', parentId: null, name: { en: 'X' }, isEnabled: true } as VertexCategory]))
      .toEqual([{ id: 'x', name: 'X', parentId: null, enabled: true }])
  })

  it('returns nothing for an empty tree', () => {
    expect(flattenVertexTree([])).toEqual([])
  })
})

describe('indexVertexTree', () => {
  it('indexes every node, children included, keeping the full record', () => {
    const byId = indexVertexTree(tree)
    expect([...byId.keys()].sort()).toEqual(['acc', 'esim', 'sim', 'tourist', 'wifi'])
    // the full record, so a screen can read the lockVersion the flat shape drops
    expect(byId.get('tourist')!.lockVersion).toBe(0)
  })
})
