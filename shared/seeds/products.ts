import type { StoredProduct } from '../types/domain'
import { SIMPOINT_ID, SKSIM_ID } from './platforms'
import { POCKET_WIFI_ID, TOURIST_SIM_ID } from './categories'

/**
 * The Vertex Commerce mock's products, with its real ids, names and SKUs.
 *
 * Mirrors the upstream set rather than inventing its own, for the same reason
 * the other seeds do: a product that exists on one side only is what makes
 * the two seams disagree. These ids are what let the Categories membership
 * panel and the product screens resolve against either one while the last
 * screens migrate.
 *
 * Shorter than the six it replaces — the upstream mock seeds three — and the
 * variants are the four the collection's own `children` examples carry, on
 * the Color × Validity axes.
 */
export const TOURIST_SIM_PRODUCT_ID = '01a116c8-6007-70ae-8cff-17c26a046588'
export const TRAVEL_PACK_ID = '01a116c8-65e6-737e-abb9-38371018112e'
export const POCKET_WIFI_PRODUCT_ID = '01a116c8-6391-73f0-ae63-ec1e8416ef3a'

export const PRODUCT_SEED: StoredProduct[] = [
  {
    id: TOURIST_SIM_PRODUCT_ID,
    name: 'Tourist SIM 15GB',
    sku: 'TSIM-15GB',
    category: 'Tourist SIM',
    categoryId: TOURIST_SIM_ID,
    status: 'Active',
    // upstream `simple`
    productType: 'single',
    hasVariants: false,
    variantCount: 0,
    platformIds: [SKSIM_ID, SIMPOINT_ID],
    attributes: [{ name: 'Data', values: ['15GB'] }],
    variants: []
  },
  {
    id: TRAVEL_PACK_ID,
    name: 'Travel Starter Pack',
    sku: 'PACK-TRAVEL',
    category: 'Pocket WiFi',
    categoryId: POCKET_WIFI_ID,
    status: 'Active',
    productType: 'bundle',
    hasVariants: false,
    variantCount: 0,
    platformIds: [SKSIM_ID, SIMPOINT_ID],
    attributes: [],
    variants: []
  },
  {
    id: POCKET_WIFI_PRODUCT_ID,
    name: 'Pocket WiFi Router X1',
    sku: 'WIFI-X1',
    category: 'Pocket WiFi',
    categoryId: POCKET_WIFI_ID,
    status: 'Active',
    // upstream `configurable`
    productType: 'variant',
    hasVariants: true,
    variantCount: 4,
    platformIds: [SKSIM_ID, SIMPOINT_ID],
    attributes: [
      { name: 'Color', values: ['Black', 'White'] },
      { name: 'Validity', values: ['8 Days', '16 Days'] }
    ],
    // names and SKUs from the collection's own `children` examples
    variants: [
      { name: 'Black / 8 Days', sku: 'WIFI-X1-8DAYS-BLACK', price: '5340', stock: '15', active: true },
      { name: 'Black / 16 Days', sku: 'WIFI-X1-16DAYS-BLACK', price: '6200', stock: '9', active: true },
      { name: 'White / 8 Days', sku: 'WIFI-X1-8DAYS-WHITE', price: '5340', stock: '4', active: true },
      { name: 'White / 16 Days', sku: 'WIFI-X1-16D-WHT', price: '6200', stock: '0', active: false }
    ]
  }
]
