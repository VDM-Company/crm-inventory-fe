import type { AttributeDef } from '~/types'

import { ATTRIBUTE_SEED as SEED } from '#shared/seeds'

// Port of the design's `window.VertexAttrs` (attribute-store.js).
// Master list of variant attribute names + their preset values, persisted
// in localStorage. Used by the Create form's variant builder (and, later,
// the Attributes master page). SSR-safe reads fall back to the seed.

const KEY = 'vertex_attributes_v1'

function clone(a: AttributeDef): AttributeDef {
  return { id: a.id, name: a.name, type: a.type, values: (a.values || []).slice() }
}

export function loadAttributeDefs(): AttributeDef[] {
  if (import.meta.client) {
    try {
      const r = JSON.parse(localStorage.getItem(KEY) || 'null')
      if (Array.isArray(r) && r.length) return r.map(clone)
    } catch {
      // ignore malformed storage
    }
  }
  return SEED.map(clone)
}

export function saveAttributeDefs(list: AttributeDef[]): void {
  if (import.meta.client) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
    } catch {
      // ignore storage failure
    }
  }
}

// How many stored products reference this attribute name (delete-protection).
export function attributeUsageCount(name: string): number {
  if (!import.meta.client) return 0
  const target = (name || '').toLowerCase()
  try {
    const products: { attributes?: { name?: string }[] }[] = JSON.parse(localStorage.getItem('vertex_products') || '[]') || []
    return products.filter(p =>
      (p.attributes || []).some(a => (a.name || '').toLowerCase() === target)
    ).length
  } catch {
    return 0
  }
}

export function attributeNames(list: AttributeDef[]): string[] {
  return list.map(a => a.name)
}

// Input type chosen on the Attributes page — drives which value editor the
// Create form renders. Legacy rows with no type behave as 'Select'.
export function attributeTypeFor(list: AttributeDef[], name: string): string {
  const def = list.find(a => a.name === name)
  return (def && def.type) || 'Select'
}

export function attributeValuesFor(list: AttributeDef[], name: string): string[] {
  const def = list.find(a => a.name === name)
  return def ? def.values.slice() : []
}

// Preset values still selectable for an attribute (presets minus already-chosen).
export function attributeAvailableFor(list: AttributeDef[], name: string, chosen: string[]): string[] {
  const used = chosen || []
  return attributeValuesFor(list, name).filter(v => used.indexOf(v) === -1)
}
