import type { AttributeDef } from '../types/domain'

export const ATTRIBUTE_SEED: AttributeDef[] = [
  { id: 'a_data', name: 'Data', values: ['5GB', '10GB', '15GB'] },
  { id: 'a_duration', name: 'Duration', values: ['8 Days', '16 Days', '31 Days'] },
  { id: 'a_color', name: 'Color', values: ['Black', 'White', 'Blue'] },
  { id: 'a_size', name: 'Size', values: ['S', 'M', 'L'] },
  { id: 'a_model', name: 'Model Type', values: [] },
  { id: 'a_material', name: 'Material', values: [] },
  { id: 'a_style', name: 'Style', values: [] },
  { id: 'a_capacity', name: 'Capacity', values: [] }
]
