import type { AttributeDef } from '#shared/types'

/**
 * The variant-attribute definitions — the master list the Create form's
 * variant builder and the Attributes page both read.
 *
 * A row that arrives without `values` gets `[]` rather than undefined, so the
 * screens can index it without a guard. (`.slice()` is a habit from the
 * localStorage store, where callers shared one array; every `list()` here is a
 * fresh parse, so it copies nothing that was shared.) `type` is left as-is:
 * legacy rows have none, and `attributeTypeFor` already reads that as 'Select'.
 */
export const useApiAttributes = () => useApiResource<AttributeDef>('attributes', a => ({
  id: a.id,
  name: a.name,
  type: a.type,
  values: (a.values || []).slice()
}))
