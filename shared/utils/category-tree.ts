import type { Category, VertexCategory } from '#shared/types'
import { localized } from './localized'

/**
 * The API's nested category tree, flattened to the shape the screens read.
 *
 * Every helper in `app/utils/categories.ts` — `categoryChildren`,
 * `categoryTreeRows`, `flattenCategories`, `categoryPathById` — works on a
 * flat list and rebuilds the hierarchy from `parentId`. Converting here keeps
 * all of them, and the four screens that only read categories change one line
 * instead of being rewritten around a different shape.
 *
 * Depth-first in the API's own order, because those helpers take list order as
 * the sibling order: a breadth-first walk would silently reshuffle the tree.
 *
 * What is dropped: `lockVersion`, `path`, `productCount`, `sortOrder` and the
 * per-platform view. A screen that needs those reads the tree itself.
 */
export function flattenVertexTree(nodes: VertexCategory[], locale = 'en'): Category[] {
  const out: Category[] = []
  const walk = (list: VertexCategory[]) => {
    for (const n of list) {
      out.push({
        id: n.id,
        name: localized(n.name, locale),
        parentId: n.parentId ?? null,
        enabled: n.isEnabled !== false
      })
      walk(n.children || [])
    }
  }
  walk(nodes)
  return out
}

/** Every node of the tree by id, for the screens that need the full record. */
export function indexVertexTree(nodes: VertexCategory[]): Map<string, VertexCategory> {
  const byId = new Map<string, VertexCategory>()
  const walk = (list: VertexCategory[]) => {
    for (const n of list) {
      byId.set(n.id, n)
      walk(n.children || [])
    }
  }
  walk(nodes)
  return byId
}
