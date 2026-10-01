import type { ApiList, Category, CategoryFlatRow, CategoryTreeRow, CatEntry, CatScopeEntry } from '~/types'

// Hierarchical category tree, served by `server/api`.
// Reads are async and can throw; the tree helpers below stay pure so they can
// run inside computeds over an already-loaded list.

function clone(c: Category): Category {
  return { id: c.id, name: c.name, parentId: c.parentId || null, enabled: c.enabled !== false }
}

export async function loadCategories(): Promise<Category[]> {
  const res = await $fetch<ApiList<Category>>('/api/categories')
  return (res.data || []).map(clone)
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
// ── per-category product membership + per-scope positions ──
// Its own sub-resource: `/api/categories/:id/products`.
export async function categoryEntry(catId: string): Promise<CatEntry> {
  const e = await $fetch<CatEntry>(`/api/categories/${catId}/products`)
  return { members: e?.members || [], scopes: (e?.scopes || {}) as Record<string, CatScopeEntry> }
}

export async function saveCategoryEntry(catId: string, entry: CatEntry): Promise<CatEntry> {
  return apiPutRaw<CatEntry>(`categories/${catId}/products`, {
    members: entry.members || [],
    scopes: entry.scopes || {}
  })
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
