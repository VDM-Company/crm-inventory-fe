// ── Vertex inventory: presentation-only shapes ──
//
// The domain types (Category, Platform, Product, …) moved to
// `shared/types/domain.ts` so `server/api` can use them too. They are
// re-exported here so the existing `import type { … } from '~/types'`
// call sites keep working.

export type * from '#shared/types'

export interface CategoryFlatRow {
  id: string
  name: string
  depth: number
  selectable: boolean
  header: boolean
}

// Full-tree row for the Categories page tree panel (every node selectable).
export interface CategoryTreeRow {
  id: string
  name: string
  depth: number
  parentId: string | null
  enabled: boolean
  childCount: number
}

// Configuration store: each platform owns its full set of values.
export interface ConfigField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'toggle'
  placeholder?: string
  synced?: boolean
}

export interface ConfigGroup {
  group: string
  title: string
  icon: string
  fields: ConfigField[]
}

// Dashboard summary tile (distinct from the template's `Stat`).
export interface DashStat {
  label: string
  value: string
  delta: string
  deltaColor: string
  icon: string
  iconBg: string
  iconColor: string
}

export type FilterField = 'name' | 'variants' | 'sku' | 'category' | 'productType' | 'platform' | 'status'

export interface FilterRule {
  id: string
  field: FilterField
  operator: 'is' | 'contains'
  value: string
  enabled: boolean
}
