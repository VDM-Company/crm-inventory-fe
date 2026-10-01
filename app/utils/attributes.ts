import type { ApiList, AttributeDef, StoredProduct } from '~/types'

// Master list of variant attribute names + their preset values, served by
// `server/api`. Used by the Create form's variant builder and the Attributes
// master page. The read is async; the helpers below stay pure.

function clone(a: AttributeDef): AttributeDef {
  return { id: a.id, name: a.name, type: a.type, values: (a.values || []).slice() }
}

export async function loadAttributeDefs(): Promise<AttributeDef[]> {
  const res = await $fetch<ApiList<AttributeDef>>('/api/attributes')
  return (res.data || []).map(clone)
}

// How many stored products reference this attribute name (delete-protection).
// How many products use this attribute (delete-protection).
// Pure: pass a list loaded with `loadProducts()` so it can drive a computed.
export function attributeUsageCount(products: StoredProduct[], name: string): number {
  const needle = (name || '').toLowerCase()
  return products.filter(p => (p.attributes || []).some(a => String(a?.name || '').toLowerCase() === needle)).length
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
