import { describe, expect, it } from 'vitest'
import {
  categoryById,
  categoryByName,
  categoryChildren,
  categoryDepthOf,
  categoryPathById,
  categorySubtreeIds,
  categoryTopLevel,
  categoryTreeRows,
  flattenCategories
} from '../../../app/utils/categories'
import type { Category } from '../../../shared/types/domain'

//  SIM Cards
//    Tourist SIM
//    Resident SIM
//      Long Stay      <- third level, so depth is really exercised
//  Devices
const tree: Category[] = [
  { id: 'sim', name: 'SIM Cards', parentId: null, enabled: true },
  { id: 'tour', name: 'Tourist SIM', parentId: 'sim', enabled: true },
  { id: 'res', name: 'Resident SIM', parentId: 'sim', enabled: true },
  { id: 'long', name: 'Long Stay', parentId: 'res', enabled: true },
  { id: 'dev', name: 'Devices', parentId: null, enabled: true }
]

describe('lookups', () => {
  it('finds by id and by name, and returns null when absent', () => {
    expect(categoryById(tree, 'tour')?.name).toBe('Tourist SIM')
    expect(categoryById(tree, 'nope')).toBeNull()
    expect(categoryById(tree, null)).toBeNull()

    expect(categoryByName(tree, 'Devices')?.id).toBe('dev')
    expect(categoryByName(tree, 'Nothing')).toBeNull()
  })

  it('lists the roots and the direct children of a node', () => {
    expect(categoryTopLevel(tree).map(c => c.id)).toEqual(['sim', 'dev'])
    expect(categoryChildren(tree, 'sim').map(c => c.id)).toEqual(['tour', 'res'])
    expect(categoryChildren(tree, 'tour')).toEqual([])
  })
})

describe('categoryDepthOf', () => {
  it('counts how far a node sits from the root', () => {
    expect(categoryDepthOf(tree, 'sim')).toBe(0)
    expect(categoryDepthOf(tree, 'tour')).toBe(1)
    expect(categoryDepthOf(tree, 'long')).toBe(2)
  })

  it('treats an unknown id as the root level', () => {
    expect(categoryDepthOf(tree, 'nope')).toBe(0)
    expect(categoryDepthOf(tree, null)).toBe(0)
  })

  it('does not hang on a parent cycle', () => {
    const cyclic: Category[] = [
      { id: 'a', name: 'A', parentId: 'b', enabled: true },
      { id: 'b', name: 'B', parentId: 'a', enabled: true }
    ]
    expect(categoryDepthOf(cyclic, 'a')).toBeLessThanOrEqual(21)
  })
})

describe('categoryPathById', () => {
  it('joins the ancestors into a breadcrumb', () => {
    expect(categoryPathById(tree, 'long')).toBe('SIM Cards / Resident SIM / Long Stay')
    expect(categoryPathById(tree, 'sim')).toBe('SIM Cards')
  })

  it('is empty for an unknown id', () => {
    expect(categoryPathById(tree, 'nope')).toBe('')
  })
})

describe('flattenCategories', () => {
  it('walks the tree depth-first and marks leaves selectable', () => {
    const rows = flattenCategories(tree)

    expect(rows.map(r => r.id)).toEqual(['sim', 'tour', 'res', 'long', 'dev'])
    expect(rows.map(r => r.depth)).toEqual([0, 1, 1, 2, 0])

    const byId = Object.fromEntries(rows.map(r => [r.id, r]))
    // a node with children is a header; a node without one is pickable
    expect(byId.sim).toMatchObject({ header: true, selectable: false })
    expect(byId.long).toMatchObject({ header: false, selectable: true })
    expect(byId.dev).toMatchObject({ header: false, selectable: true })
  })
})

describe('categoryTreeRows', () => {
  it('reports each node with its parent and child count', () => {
    const rows = categoryTreeRows(tree)
    const byId = Object.fromEntries(rows.map(r => [r.id, r]))

    expect(byId.sim).toMatchObject({ depth: 0, parentId: null, childCount: 2 })
    expect(byId.res).toMatchObject({ depth: 1, parentId: 'sim', childCount: 1 })
    expect(byId.long).toMatchObject({ depth: 2, parentId: 'res', childCount: 0 })
  })
})

describe('categorySubtreeIds', () => {
  it('includes the node itself and every descendant', () => {
    expect(categorySubtreeIds(tree, 'sim').sort()).toEqual(['long', 'res', 'sim', 'tour'])
    expect(categorySubtreeIds(tree, 'long')).toEqual(['long'])
  })
})
