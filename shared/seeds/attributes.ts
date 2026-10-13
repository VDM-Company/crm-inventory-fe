import type { AttributeDef } from '../types/domain'

/**
 * The Vertex Commerce mock's attributes, with its real ids.
 *
 * Products reference attributes by NAME, not by id, so the names and option
 * labels matter more here than the ids do — but the ids are the upstream's
 * anyway, so the Attributes screen resolves against either seam.
 *
 * `type` is the older vocabulary: upstream `dropdown` and `swatch` both
 * present as a list of choices, and `text` is free entry.
 */
export const ATTR_COLOR_ID = '01a116c8-5eb3-71b2-b4b5-618a20332350'
export const ATTR_DATA_ID = '01a116c8-5e8e-70d0-83b6-4b5eff865d8e'
export const ATTR_NETWORK_ID = '01a116c8-5f01-7336-bb2a-1aa0e6277eda'

export const ATTRIBUTE_SEED: AttributeDef[] = [
  { id: ATTR_COLOR_ID, name: 'Color', type: 'Select', values: ['Black', 'White'] },
  { id: ATTR_DATA_ID, name: 'Data', type: 'Select', values: ['15GB', '30GB', 'Unlimited'] },
  { id: ATTR_NETWORK_ID, name: 'Network', type: 'Text', values: [] }
]
