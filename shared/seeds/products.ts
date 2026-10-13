import type { StoredProduct } from '../types/domain'

export const PRODUCT_SEED: StoredProduct[] = [
  {
    id: 'p_tourist',
    name: 'Tourist SIM 15GB',
    sku: 'SKU-2000',
    category: 'SIM Card',
    categoryId: 'c_sim',
    status: 'Active',
    productType: 'variant',
    hasVariants: true,
    variantCount: 6,
    platformIds: ['p_sp', 'p_sk'],
    attributes: [{ name: 'Data', values: ['15GB'] }, { name: 'Duration', values: ['8 Days', '16 Days', '31 Days'] }],
    variants: [
      { name: '15GB / 8 Days', sku: 'SKU-2000-01', price: '24', stock: '42', active: true },
      { name: '15GB / 16 Days', sku: 'SKU-2000-02', price: '32', stock: '28', active: true },
      { name: '15GB / 31 Days', sku: 'SKU-2000-03', price: '44', stock: '12', active: false }
    ]
  },
  {
    id: 'p_unlimited',
    name: 'Unlimited Data Plan 30D',
    sku: 'SKU-2003',
    category: 'Data Plan',
    categoryId: 'c_data',
    status: 'Active',
    productType: 'single',
    hasVariants: false,
    variantCount: 0,
    platformIds: ['p_sk'],
    attributes: [],
    variants: []
  },
  {
    id: 'p_wifi',
    name: 'Pocket WiFi Router X1',
    sku: 'SKU-2002',
    category: 'WiFi',
    categoryId: 'c_wifi',
    status: 'Active',
    productType: 'variant',
    hasVariants: true,
    variantCount: 4,
    platformIds: ['p_sp'],
    attributes: [{ name: 'Color', values: ['Black', 'White', 'Blue', 'Green'] }],
    variants: [
      { name: 'Black', sku: 'SKU-2002-01', price: '60', stock: '15', active: true },
      { name: 'White', sku: 'SKU-2002-02', price: '60', stock: '9', active: true },
      { name: 'Blue', sku: 'SKU-2002-03', price: '62', stock: '4', active: true },
      { name: 'Green', sku: 'SKU-2002-04', price: '62', stock: '0', active: false }
    ]
  },
  {
    id: 'p_bundle',
    name: 'Travel Connectivity Bundle',
    sku: 'SKU-2006',
    category: 'SIM Card',
    categoryId: 'c_sim',
    status: 'Active',
    productType: 'bundle',
    hasVariants: false,
    variantCount: 0,
    platformIds: ['p_sp', 'p_sk'],
    attributes: [],
    variants: []
  },
  {
    id: 'p_esim',
    name: 'eSIM Global 5GB',
    sku: 'SKU-2005',
    category: 'SIM Card',
    categoryId: 'c_sim',
    status: 'Inactive',
    productType: 'single',
    hasVariants: false,
    variantCount: 0,
    platformIds: ['p_sp'],
    attributes: [],
    variants: []
  },
  {
    id: 'p_prepaid',
    name: 'Prepaid Data Plan 7D',
    sku: 'SKU-2004',
    category: 'Data Plan',
    categoryId: 'c_data',
    status: 'Active',
    productType: 'variant',
    hasVariants: true,
    variantCount: 3,
    platformIds: ['p_sk'],
    attributes: [{ name: 'Data', values: ['3GB', '5GB', '10GB'] }],
    variants: [
      { name: '3GB', sku: 'SKU-2004-01', price: '12', stock: '30', active: true },
      { name: '5GB', sku: 'SKU-2004-02', price: '18', stock: '22', active: true },
      { name: '10GB', sku: 'SKU-2004-03', price: '28', stock: '11', active: true }
    ]
  }
]
