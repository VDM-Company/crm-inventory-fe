import type { Category, CategoryFlatRow, CategoryTreeRow, CatEntry, CatScopeEntry } from '~/types'

import { CATEGORY_SEED } from '#shared/seeds'

// Port of the design's `window.VertexCat` (category-store.js).
// Hierarchical category tree persisted in localStorage. All reads are
// SSR-safe — on the server `localStorage` is undefined and we fall back
// to DEFAULTS so the first render matches the client's initial paint.

const KEY = 'vertex_categories_v3'
const PROD_KEY = 'vertex_cat_products_v1'

const DEFAULTS = CATEGORY_SEED

function clone(c: Category): Category {
  return { id: c.id, name: c.name, parentId: c.parentId || null, enabled: c.enabled !== false }
}

export function loadCategories(): Category[] {
  if (import.meta.client) {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (Array.isArray(r) && r.length) return r.map(clone)
    } catch {
      // ignore malformed storage
    }
  }
  return DEFAULTS.map(clone)
}

export function saveCategories(list: Category[]): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      // ignore storage failure
    }
  }
}

export function categoryById(list: Category[], id: string | null): Category | null {
  return list.find(c => c.id === id) || null
}

export function categoryTopLevel(list: Category[]): Category[] {
  return list.filter(c => !c.parentId)
}

export function categoryByName(list: Category[], name: string): Category | null {
  return list.find(c => c.name === name) || null
}

export function categoryChildren(list: Category[], id: string | null): Category[] {
  return list.filter(c => c.parentId === id)
}

// Port of the store's `depthOf`: 0 for a root category, +1 per ancestor.
export function categoryDepthOf(list: Category[], id: string | null): number {
  let depth = 0
  let guard = 0
  let c = categoryById(list, id)
  while (c && c.parentId && guard++ < 20) {
    depth++
    c = categoryById(list, c.parentId)
  }
  return depth
}

export function categoryPathById(list: Category[], id: string): string {
  const parts: string[] = []
  let guard = 0
  let c = categoryById(list, id)
  while (c && guard++ < 20) {
    parts.unshift(c.name)
    c = c.parentId ? categoryById(list, c.parentId) : null
  }
  return parts.join(' / ')
}

// Ordered rows for the hierarchical dropdown; parent nodes are headers.
export function flattenCategories(list: Category[]): CategoryFlatRow[] {
  const out: CategoryFlatRow[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const c of categoryChildren(list, parentId)) {
      const kids = categoryChildren(list, c.id)
      out.push({ id: c.id, name: c.name, depth, selectable: kids.length === 0, header: kids.length > 0 })
      if (kids.length) walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

// Full-tree rows (depth-ordered, all nodes) for the Categories tree panel.
export function categoryTreeRows(list: Category[]): CategoryTreeRow[] {
  const out: CategoryTreeRow[] = []
  const walk = (parentId: string | null, depth: number) => {
    for (const c of categoryChildren(list, parentId)) {
      out.push({
        id: c.id,
        name: c.name,
        depth,
        parentId: c.parentId,
        enabled: c.enabled !== false,
        childCount: categoryChildren(list, c.id).length
      })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

// ── per-category product membership + per-scope positions store ──
// Shape: { <catId>: { members: [pid], scopes: { default: {positions}, <pid>: {positions, override} } } }
export function loadCatProducts(): Record<string, CatEntry> {
  if (import.meta.client) {
    try {
      return JSON.parse(localStorage.getItem(PROD_KEY) || '{}') || {}
    } catch {
      // ignore malformed storage
    }
  }
  return {}
}

export function saveCatProducts(all: Record<string, CatEntry>): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(PROD_KEY, JSON.stringify(all))
    } catch {
      // ignore storage failure
    }
  }
}

export function categoryEntry(catId: string): CatEntry {
  const e = loadCatProducts()[catId]
  return { members: e?.members || [], scopes: (e?.scopes || {}) as Record<string, CatScopeEntry> }
}

export function saveCategoryEntry(catId: string, entry: CatEntry): void {
  const all = loadCatProducts()
  all[catId] = { members: entry.members || [], scopes: entry.scopes || {} }
  saveCatProducts(all)
}

// Self + ALL descendant ids — filtering by a parent matches its whole subtree.
export function categorySubtreeIds(list: Category[], id: string): string[] {
  const ids: string[] = [id]
  const walk = (pid: string) => {
    for (const k of categoryChildren(list, pid)) {
      ids.push(k.id)
      walk(k.id)
    }
  }
  walk(id)
  return ids
}
