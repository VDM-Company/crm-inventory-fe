import type { AttributeDef } from '~/types'

// Pure helpers over an already-loaded attribute list — the Create form's
// variant builder and the Attributes master page both read it through
// `useApiAttributes()`.

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
