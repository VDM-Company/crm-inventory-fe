<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type {
  AttributeDef,
  Category,
  Fee,
  Platform,
  ProductStatus,
  ProductType
} from '~/types'

useHead({ title: 'Product Detail — Vertex' })

const route = useRoute()
const router = useRouter()

// ── shapes ──
interface DetailVariant { name: string, sku: string, price: number | string, stock: number | string, active: boolean, image?: string | null }
interface PricingComponent { feeId: string, published: boolean, amount: string | number }
interface PricingVersion { version?: string, isSubscription?: boolean, monthly?: string | number, initial?: number, components?: PricingComponent[], active?: boolean }
interface DetailProduct {
  id: string | null
  name: string
  sku: string
  productType: ProductType
  hasVariants?: boolean
  notes?: string
  description?: string
  category?: string
  categoryId?: string
  categoryPath?: string
  platform?: string
  platformIds: string[]
  platformNames?: string[]
  status: ProductStatus
  stock?: string
  notForSale?: boolean
  image?: string | null
  attributes?: { name: string, values: string[] }[]
  variants?: DetailVariant[]
  bundle?: { components: { name: string, products: { id?: string, name: string, sku: string }[] }[] } | null
  // pricing is passthrough only — this screen no longer edits it
  pricing?: PricingVersion[]
  overrides?: Overrides
  variantCount?: number
}
interface EditAttr { id: string, name: string, values: string[] }
interface ScopeOverride { name?: string, priceMonthly?: string | number, componentAmounts?: Record<string, string> }
type Overrides = Record<string, ScopeOverride>
interface HistoryChange { field: string, from: string, to: string }
interface HistoryEntry { id: string, actor: string, ts: number, changes: HistoryChange[] }
interface HistoryRow {
  id: string
  actor: string
  initials: string
  avatarStyle: string
  timestamp: string
  isCurrent: boolean
  rowStyle: string
  visibleChanges: HistoryChange[]
  hasMore: boolean
  toggleLabel: string
  toggleIcon: string
}

const DAY = 86400000

const DEMO_PRODUCT: DetailProduct = {
  id: null,
  name: 'Tourist SIM 15GB',
  sku: 'SKU-2000',
  productType: 'variant',
  notes: 'Best seller for inbound travelers. Restocked every 6 weeks.',
  category: 'SIM Card',
  platform: 'SK SIM',
  platformIds: ['p_sk'],
  status: 'Active',
  image: null,
  attributes: [
    { name: 'Data', values: ['15GB'] },
    { name: 'Duration', values: ['8 Days', '16 Days', '31 Days'] }
  ],
  variants: [
    { name: '15GB / 8 Days', sku: 'SKU-2000-01', price: 24, stock: 42, active: true },
    { name: '15GB / 16 Days', sku: 'SKU-2000-02', price: 32, stock: 28, active: true },
    { name: '15GB / 31 Days', sku: 'SKU-2000-03', price: 44, stock: 12, active: false }
  ]
}

// Seeded on mount only — the relative timestamps need `Date.now()`, which would
// otherwise differ between server and client render (hydration mismatch).
function seedHistory(): HistoryEntry[] {
  const now = Date.now()
  return [
    { id: 's1', actor: 'Olivia Rhye', ts: now - 3600000, changes: [
      { field: 'Status', from: 'Inactive', to: 'Active' },
      { field: 'Price (SIM Point)', from: '¥1,200', to: '¥1,300' },
      { field: 'Stock', from: 'Out of stock', to: 'In stock' }
    ] },
    { id: 's2', actor: 'Phoenix Baker', ts: now - DAY - 5400000, changes: [
      { field: 'Variant 15GB / 8 Days — Price', from: '¥24', to: '¥26' }
    ] },
    { id: 's3', actor: 'Demi Wilkinson', ts: now - DAY * 4 - 7200000, changes: [
      { field: 'Description', from: '—', to: 'Tourist data SIM, valid 8–31 days' },
      { field: 'Mark as gift', from: 'Yes', to: 'No' }
    ] },
    { id: 's4', actor: 'Candice Wu', ts: now - DAY * 12 - 3600000, changes: [
      { field: 'Category', from: 'Data Plan', to: 'SIM Card' }
    ] }
  ]
}

// ── state (mirrors the design's DCLogic state) ──
const mode = ref<'view' | 'edit'>('view')
const openDropdown = ref<string | null>(null)
const scope = ref('default')
const draftOverrides = ref<Overrides>({})

// ── pricing (re-added in Master v3 for non-variant products) ──
const fees = ref<Fee[]>([])
const editIsSubscription = ref(true)
const editMonthly = ref<string | number>('')
const editInitialComponents = ref<PricingComponent[]>([])
const editAttributes = ref<EditAttr[]>([])
const editVariants = ref<DetailVariant[]>([])
const editAppliedKey = ref<string | null>(null)
const cancelConfirmOpen = ref(false)
const deleteConfirmOpen = ref(false)
const { message: toastMessage, show: showToast } = usePageToast()
const saveError = ref('')
const loading = ref(true)
const historyOpen = ref(false)
const historyExpanded = ref<Record<string, boolean>>({})
const historyEntries = ref<HistoryEntry[]>([])

const categories = ref<Category[]>([])
const platforms = ref<Platform[]>([])
const attributeDefs = ref<AttributeDef[]>([])

const isStored = ref(false)
let editSnapshot: string | null = null
let deleteTimer: number | null = null

function normalizeProduct(rec: DetailProduct | null): { product: DetailProduct, stored: boolean } {
  const base: DetailProduct = rec ? { ...DEMO_PRODUCT, ...rec } : { ...DEMO_PRODUCT }
  if (!base.platformIds) base.platformIds = []
  if (base.productType !== 'bundle') {
    const hv = base.productType === 'variant' || !!base.hasVariants || !!(base.variants && base.variants.length)
    base.productType = hv ? 'variant' : 'single'
    base.hasVariants = hv
  }
  return { product: base, stored: !!rec }
}

// SSR-safe: both server and first client paint render the DEMO product
// (deterministic); the real record is swapped in on mount.
const seededDemo = normalizeProduct(null).product
const product = ref<DetailProduct>({ ...seededDemo })
const draft = ref<DetailProduct>({ ...seededDemo })

async function loadRecordById(rawId: unknown): Promise<DetailProduct | null> {
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (!id) return null
  try {
    return await loadProduct(id) as DetailProduct
  } catch (err) {
    // Only an unknown id falls back to the demo record. Any other failure has
    // to surface: showing demo data for a real id would let someone edit it
    // and get a success toast while `persist` quietly skips the write.
    if ((err as { statusCode?: number })?.statusCode === 404) return null
    saveError.value = apiErrorMessage(err, 'Could not load this product.')
    throw err
  }
}

onMounted(async () => {
  try {
    ;[categories.value, platforms.value, attributeDefs.value, fees.value] = await Promise.all([
      loadCategories(), loadPlatforms(), loadAttributeDefs(), loadFees()
    ])
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Could not load the form data.')
  }
  historyEntries.value = seedHistory()
  try {
    const rec = await loadRecordById(route.query.id)
    const norm = normalizeProduct(rec)
    product.value = norm.product
    draft.value = { ...norm.product }
    isStored.value = norm.stored
  } catch {
    // the error is already on screen; don't present the demo record
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  // the toast owns its own timer; this one drives the post-delete redirect
  if (deleteTimer !== null) clearTimeout(deleteTimer)
})

const isEditMode = computed(() => mode.value === 'edit')
const isViewMode = computed(() => mode.value === 'view')

// ── inline-style helpers (ported) ──
function badgeStyle(status: string) {
  const active = status === 'Active'
  return `display:inline-block;font-size:12px;font-weight:700;padding:3px 12px;border-radius:999px;background:${active ? '#ecfdf5' : '#f1f5f9'};color:${active ? '#00a155' : '#64748b'};border:1px solid ${active ? '#a7f3d0' : '#e2e8f0'};`
}
const BADGE_OVERRIDE = 'font-size:11px;font-weight:700;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:1px 8px;white-space:nowrap;'
const BADGE_INHERIT = 'font-size:11px;font-weight:600;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:1px 8px;white-space:nowrap;'

function toggleDropdown(key: string) {
  openDropdown.value = openDropdown.value === key ? null : key
}
function closeDropdown() {
  openDropdown.value = null
}

// ── attribute / variant helpers ──
function normalizeAttrs(p: DetailProduct): { name: string, values: string[] }[] {
  let attrs = p.attributes || []
  const firstVal = attrs.length ? (attrs[0]!.values || [])[0] : undefined
  if (attrs.length && typeof firstVal === 'object') {
    attrs = attrs.map(a => ({ name: a.name, values: (a.values as unknown as { label: string }[]).map(v => v.label) }))
  } else if (!attrs.length && p.variants && p.variants.length) {
    attrs = [{ name: 'Variant', values: p.variants.map(v => v.name) }]
  }
  return attrs.map(a => ({ name: a.name, values: [...a.values] }))
}
function regenerateVariants(attrs: EditAttr[], existing: DetailVariant[]): DetailVariant[] {
  const use = attrs.filter(a => a.name && a.name.trim() && a.values && a.values.length > 0)
  if (!use.length) return []
  let combos: string[][] = [[]]
  use.forEach((a) => {
    const next: string[][] = []
    combos.forEach(c => a.values.forEach(v => next.push([...c, v])))
    combos = next
  })
  const byName: Record<string, DetailVariant> = {}
  ;(existing || []).forEach((v) => {
    byName[v.name] = v
  })
  return combos.map((c) => {
    const name = c.join(' / ')
    const ex = byName[name]
    return ex ? { ...ex, name } : { name, sku: '', price: '', stock: '', active: true, image: null }
  })
}
function seedEditState(p: DetailProduct) {
  const attrs = normalizeAttrs(p).map((a, i) => ({ id: 'ea' + i, name: a.name, values: [...a.values] }))
  const variants = regenerateVariants(attrs, p.variants || [])
  return { attrs, variants }
}
const attrKey = (attrs: EditAttr[]) => JSON.stringify((attrs || []).map(a => ({ name: a.name, values: a.values })))

// ── category ──
const catFlat = computed(() =>
  flattenCategories(categories.value).map((o) => {
    const selected = o.id === draft.value.categoryId
    // every row is selectable; parents just read bolder
    const style = `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;padding-left:${o.depth ? (10 + o.depth * 16) : 10}px;font-size:14px;color:${selected ? '#047857' : '#0f172a'};font-weight:${selected ? 600 : (o.header ? 600 : 400)};cursor:pointer;`
    return { value: o.id, name: o.name, selected, style }
  })
)
const hasCat = computed(() => !!(draft.value.categoryId || draft.value.category))
const catDisplay = computed(() =>
  draft.value.categoryId ? categoryPathById(categories.value, draft.value.categoryId) : (draft.value.category || 'Select category')
)
function catPathOf(p: DetailProduct): string {
  if (p.categoryPath) return p.categoryPath
  if (p.categoryId) return categoryPathById(categories.value, p.categoryId)
  const c = p.category ? categoryByName(categories.value, p.category) : null
  return c ? categoryPathById(categories.value, c.id) : (p.category || '')
}
const categoryPathLabel = computed(() => catPathOf(product.value))
function pickCategory(id: string) {
  const cat = categoryById(categories.value, id)
  if (!cat) return
  draft.value = { ...draft.value, categoryId: id, category: cat.name }
  closeDropdown()
}

// ── platforms ──
const platformNamesOf = (ids: string[]) => (ids || []).map(id => platformById(platforms.value, id)?.name).filter((n): n is string => !!n)
const viewPlatformNames = computed(() => {
  const p = product.value
  let names = (p.platformNames && p.platformNames.length) ? p.platformNames.slice() : platformNamesOf(p.platformIds || [])
  if (!names.length && p.platform && p.platformIds && p.platformIds.length) names = [p.platform]
  return names
})
const editPlatformChips = computed(() =>
  (draft.value.platformIds || []).map(id => platformById(platforms.value, id)).filter((p): p is Platform => !!p)
)
const availablePlatforms = computed(() =>
  platforms.value.filter(p => (draft.value.platformIds || []).indexOf(p.id) === -1)
)
const platformItems = computed(() => availablePlatforms.value.map(p => ({ value: p.id, name: p.name })))
const platformAllAssigned = computed(() => platforms.value.length > 0 && availablePlatforms.value.length === 0)
const platformAddLabel = computed(() => editPlatformChips.value.length ? 'Add another platform' : 'Add platform')
function addDraftPlatform(id: string) {
  draft.value = { ...draft.value, platformIds: [...(draft.value.platformIds || []), id] }
  closeDropdown()
}
function removeDraftPlatform(id: string) {
  draft.value = { ...draft.value, platformIds: (draft.value.platformIds || []).filter(x => x !== id) }
}

// ── scope ──
const assignedScopePlatforms = computed(() =>
  (draft.value.platformIds || []).map(id => platformById(platforms.value, id)).filter((p): p is Platform => !!p)
)
// variant products get no scope UI at all (per-variant pricing makes it moot)
const showScopeCard = computed(() => assignedScopePlatforms.value.length > 0 && product.value.productType !== 'variant')
const isPlatformScope = computed(() => isEditMode.value && scope.value !== 'default')
const isViewPlatformScope = computed(() => !isEditMode.value && scope.value !== 'default')
const scopeOv = computed<ScopeOverride>(() => draftOverrides.value[scope.value] || {})
const scopeItems = computed(() =>
  [{ id: 'default', name: 'Default (All Platforms)' }]
    .concat(assignedScopePlatforms.value.map(p => ({ id: p.id, name: p.name })))
    .map(it => ({ value: it.id, name: it.name, selected: it.id === scope.value }))
)
const scopeLabel = computed(() => (scopeItems.value.find(x => x.value === scope.value) || scopeItems.value[0])?.name || 'Default (All Platforms)')
function setScope(id: string) {
  scope.value = id
  closeDropdown()
}

// ── name (scope-aware in edit) ──
const nameHasOverride = computed(() => isPlatformScope.value && Object.prototype.hasOwnProperty.call(scopeOv.value, 'name'))
const nameFieldValue = computed(() =>
  isPlatformScope.value ? (nameHasOverride.value ? scopeOv.value.name : draft.value.name) : draft.value.name
)
function onNameChange(raw: string | number) {
  const val = String(raw ?? '')
  if (isPlatformScope.value) {
    const sc = scope.value
    draftOverrides.value = { ...draftOverrides.value, [sc]: { ...(draftOverrides.value[sc] || {}), name: val } }
  } else {
    draft.value = { ...draft.value, name: val }
  }
}
function onNameReset() {
  const sc = scope.value
  const o = { ...(draftOverrides.value[sc] || {}) }
  delete o.name
  draftOverrides.value = { ...draftOverrides.value, [sc]: o }
}

// ── form validation (zod + UForm) ──
const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required.')
}).superRefine((_val, ctx) => {
  // the field above shows the *effective* name, so a blank global name can hide
  // behind a platform override — check it too
  if (!String(draft.value.name || '').trim()) {
    ctx.addIssue({ code: 'custom', path: ['name'], message: 'Product name is required.' })
  }
})
type ProductSchema = { name: string }

// the validated name is the *effective* one, which differs per scope
const formState = reactive({
  get name() {
    return String(nameFieldValue.value ?? '')
  }
})

// ── stock / status / not for sale ──
const stockValue = computed(() => draft.value.stock === 'out_stock' ? 'out_stock' : 'in_stock')
const stockLabel = computed(() => stockValue.value === 'out_stock' ? 'Out of Stock' : 'In Stock')
function stockDot(colour: string) {
  return `width:8px;height:8px;border-radius:999px;flex-shrink:0;background:${colour};`
}
const stockDotStyle = computed(() => stockDot(stockValue.value === 'out_stock' ? '#dc2626' : '#00c16a'))
const stockMenuItems = computed(() => ([
  { value: 'in_stock', name: 'In Stock', dot: '#00c16a' },
  { value: 'out_stock', name: 'Out of Stock', dot: '#dc2626' }
]).map(o => ({ value: o.value, name: o.name, selected: stockValue.value === o.value, meta: { dot: o.dot } })))
// under a platform scope only Name and Price are overridable — Stock is global
const stockLocked = computed(() => isPlatformScope.value)
function onToggleStockDropdown() {
  if (!stockLocked.value) toggleDropdown('stock')
}
function pickStock(value: string) {
  draft.value = { ...draft.value, stock: value }
  closeDropdown()
}

const draftActive = computed(() => draft.value.status === 'Active')
function toggleStatus() {
  draft.value = { ...draft.value, status: draftActive.value ? 'Inactive' : 'Active' }
}
const statusHelper = computed(() =>
  (isEditMode.value ? draftActive.value : product.value.status === 'Active')
    ? 'Active — available for use'
    : 'Inactive — hidden from use'
)
const notForSaleHelper = computed(() =>
  (isEditMode.value ? draft.value.notForSale : product.value.notForSale)
    ? 'Marked as gift'
    : 'Regular product'
)
const notForSaleBadge = computed(() => product.value.notForSale ? 'Gift' : '')
const notForSaleBadgeStyle = computed(() => badgeStyle(product.value.notForSale ? 'Active' : 'Inactive'))
function toggleNotForSale() {
  draft.value = { ...draft.value, notForSale: !draft.value.notForSale }
}

// ── variants ──
const isVariantProduct = computed(() => !!product.value.hasVariants)
const isBundleProduct = computed(() => product.value.productType === 'bundle')
const bundleComps = computed(() => (product.value.bundle && product.value.bundle.components) ? product.value.bundle.components : [])
const bundleComponentRows = computed(() =>
  bundleComps.value.map(c => ({
    title: /component$/i.test((c.name || '').trim()) ? c.name.trim() : ((c.name || '').trim() + ' Component'),
    products: c.products || []
  }))
)
const variantParentKey = computed(() => (isStored.value && product.value.id) ? product.value.id : 'demo')
// Shape produced by `viewVariantRows` below.
interface ViewVariantRow {
  name: string
  skuLabel: string
  attrChips: string[]
  priceLabel: string
  stockLabel: string
  statusLabel: string
  detailTo: { path: string, query: Record<string, string> }
}

const viewVariantColumns: TableColumn<ViewVariantRow>[] = [
  { accessorKey: 'name', header: 'Variant', meta: { class: { th: 'px-4', td: 'px-4' } } },
  { accessorKey: 'skuLabel', header: 'Variant SKU' },
  { accessorKey: 'attrChips', header: 'Attributes' },
  { accessorKey: 'priceLabel', header: 'Price', meta: { class: { th: 'w-[100px]' } } },
  { accessorKey: 'stockLabel', header: 'Stock', meta: { class: { th: 'w-[90px]' } } },
  { accessorKey: 'statusLabel', header: 'Status', meta: { class: { th: 'px-4 w-[100px]', td: 'px-4' } } },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-4 text-right w-[120px]', td: 'px-4' } } }
]

const viewVariantRows = computed(() =>
  (product.value.variants || []).map(v => ({
    name: v.name,
    skuLabel: v.sku || '—',
    attrChips: (v.name || '').split(' / '),
    priceLabel: (v.price !== '' && v.price != null) ? '¥' + Number(v.price).toFixed(2) : '—',
    stockLabel: (v.stock !== '' && v.stock != null) ? String(v.stock) : '—',
    statusLabel: v.active ? 'Active' : 'Inactive',
    detailTo: { path: '/products/variant-detail', query: { product: variantParentKey.value, variant: v.name } }
  }))
)
const variantCountLabel = computed(() => {
  const n = isEditMode.value ? editVariants.value.length : (product.value.variants ? product.value.variants.length : 0)
  return n === 1 ? '1 variant' : n + ' variants'
})

// ── variant attribute builder (edit; combinations regenerate only on Apply) ──
const attributeTypeOptions = computed(() => attributeNames(attributeDefs.value))
const editAttrRows = computed(() =>
  editAttributes.value.map((a) => {
    const options = attributeAvailableFor(attributeDefs.value, a.name, a.values)
    return {
      id: a.id,
      name: a.name,
      valueChips: a.values,
      valueOptions: options,
      canAddValue: !!a.name && options.length > 0,
      noValueOptions: !a.name || options.length === 0,
      valuesEmptyHint: a.name
        ? (attributeValuesFor(attributeDefs.value, a.name).length ? 'All values added' : 'No preset values — add on the Attributes page')
        : 'Select an attribute first'
    }
  })
)
function updateEditAttr(id: string, fn: (a: EditAttr) => EditAttr) {
  editAttributes.value = editAttributes.value.map(a => a.id === id ? fn(a) : a)
}
function onAttrNameChange(id: string, name: string) {
  updateEditAttr(id, a => ({ ...a, name, values: [] }))
}
// The "+ Add value" pickers are menus, not selects: the value is never kept.
// `null` holds Reka in controlled mode so the trigger falls back to its
// placeholder after each pick — `undefined` makes it go uncontrolled and the
// last pick sticks. The cast is only to satisfy USelect's prop type.
const NO_VALUE = null as unknown as string | undefined

function addAttrValue(id: string, v: string) {
  if (!v) return
  updateEditAttr(id, a => a.values.indexOf(v) === -1 ? { ...a, values: [...a.values, v] } : a)
}
function removeAttrValue(id: string, value: string) {
  updateEditAttr(id, a => ({ ...a, values: a.values.filter(val => val !== value) }))
}
function removeEditAttr(id: string) {
  editAttributes.value = editAttributes.value.filter(a => a.id !== id)
}
function addEditAttribute() {
  editAttributes.value = [...editAttributes.value, { id: 'ea' + Date.now(), name: '', values: [] }]
}
const editApplyDisabled = computed(() => {
  const valid = editAttributes.value.some(a => a.name && a.name.trim() && a.values.length > 0)
  if (!valid) return true
  return attrKey(editAttributes.value) === editAppliedKey.value
})
function applyEditVariants() {
  editVariants.value = regenerateVariants(editAttributes.value, editVariants.value)
  editAppliedKey.value = attrKey(editAttributes.value)
}
function updateEditVariant(name: string, field: 'sku' | 'price' | 'stock' | 'image' | 'active', value: string | boolean) {
  editVariants.value = editVariants.value.map(v => v.name === name ? { ...v, [field]: value } : v)
}
function removeEditVariant(name: string) {
  editVariants.value = editVariants.value.filter(v => v.name !== name)
}

const notesDisplay = computed(() => product.value.notes && product.value.notes.trim() ? product.value.notes : '—')
const productTypeLabel = computed(() => product.value.productType ? product.value.productType.charAt(0).toUpperCase() + product.value.productType.slice(1) : '')
// v3 removed the lower spacer entirely
const showLowerSpacer = computed(() => false)

// ── pricing card (non-variant products only) ──
const isSinglePricing = computed(() => !isVariantProduct.value)
const basePricingVersion = computed<PricingVersion>(() => product.value.pricing?.[0] || {})

function feeNameOf(feeId: string) {
  return feeById(fees.value, feeId)?.name || 'Component'
}
function yen(n: number) {
  return '¥' + Math.round(n).toLocaleString('en-US')
}

const viewIsSubscription = computed(() => {
  const v = basePricingVersion.value
  return v.isSubscription === undefined ? true : !!v.isSubscription
})
const viewSubscriptionLabel = computed(() =>
  viewIsSubscription.value ? 'Recurring — monthly fee' : 'One-time purchase'
)
const viewMonthlyLabel = computed(() => {
  const m = basePricingVersion.value.monthly
  return (m === '' || m == null) ? '—' : '¥' + Number(m).toFixed(2)
})
// Deviation from the design: it reads the breakdown from DEMO pricing only, so
// a stored product always rendered an empty table. Read the stored record.
const publishedBaseComponents = computed(() =>
  (basePricingVersion.value.components || []).filter(c => c.published === undefined ? true : c.published)
)
const initialBreakdown = computed(() => publishedBaseComponents.value.map(c => ({
  feeId: c.feeId,
  label: feeNameOf(c.feeId),
  amountLabel: yen(parseFloat(String(c.amount)) || 0)
})))
const hasInitialBreakdown = computed(() => initialBreakdown.value.length > 0)
const initialBreakdownTotal = computed(() =>
  yen(publishedBaseComponents.value.reduce((t, c) => t + (parseFloat(String(c.amount)) || 0), 0))
)

const subscriptionHelper = computed(() =>
  editIsSubscription.value ? 'Recurring — customers pay a monthly fee.' : 'One-time purchase — no monthly fee.'
)
const editSubscriptionLabel = computed(() =>
  editIsSubscription.value ? 'Subscription' : 'One-time purchase'
)
// Under a platform scope the component set is fixed in Default — only amounts
// are overridable here.
const feeComponentsLocked = computed(() => scope.value !== 'default')
const canAddEditComponent = computed(() => scope.value === 'default')

const scopeComponentAmounts = computed<Record<string, string>>(() =>
  (draftOverrides.value[scope.value] || {}).componentAmounts || {}
)

const editComponentRows = computed(() => {
  const locked = feeComponentsLocked.value
  const chosen = editInitialComponents.value.map(c => c.feeId).filter(Boolean)
  return editInitialComponents.value.map((c, i) => {
    const isBase = c.feeId === FEE_BASE_ID
    const amt = locked
      ? (scopeComponentAmounts.value[c.feeId] !== undefined ? scopeComponentAmounts.value[c.feeId] : '')
      : c.amount
    return {
      index: i,
      feeId: c.feeId,
      name: feeById(fees.value, c.feeId)?.name || 'Select component...',
      locked: isBase,
      selectable: !isBase,
      selectDisabled: locked,
      // name only: USelect renders a `description` field if the item carries
      // one, which the native <option> ignored
      options: fees.value
        .filter(f => f.id === c.feeId || chosen.indexOf(f.id) === -1)
        .map(f => ({ id: f.id, name: f.name })),
      amount: amt,
      published: c.published,
      publishLocked: isBase || locked,
      publishTitle: isBase
        ? 'Base Price is always published'
        : (locked ? 'Publish is set in Default scope' : (c.published ? 'Published' : 'Unpublished')),
      canRemove: !isBase && !locked,
      dimmed: !c.published
    }
  })
})

function setComponentFee(index: number, feeId: string) {
  editInitialComponents.value = editInitialComponents.value.map((x, i) => i === index ? { ...x, feeId } : x)
}
function setComponentAmount(index: number, value: string) {
  if (scope.value === 'default') {
    editInitialComponents.value = editInitialComponents.value.map((x, i) => i === index ? { ...x, amount: value } : x)
    return
  }
  const sc = scope.value
  const cur = { ...(draftOverrides.value[sc] || {}) }
  const amts = { ...(cur.componentAmounts || {}) }
  const fid = editInitialComponents.value[index]?.feeId || ''
  if (value === '') Reflect.deleteProperty(amts, fid)
  else amts[fid] = value
  cur.componentAmounts = amts
  draftOverrides.value = { ...draftOverrides.value, [sc]: cur }
}
function toggleComponentPublish(index: number) {
  const c = editInitialComponents.value[index]
  if (!c || c.feeId === FEE_BASE_ID || feeComponentsLocked.value) return
  editInitialComponents.value = editInitialComponents.value.map((x, i) => i === index ? { ...x, published: !x.published } : x)
}
function removeComponent(index: number) {
  editInitialComponents.value = editInitialComponents.value.filter((_, i) => i !== index)
}
function addEditComponent() {
  editInitialComponents.value = [...editInitialComponents.value, { feeId: '', published: true, amount: '' }]
}

const editInitialTotal = computed(() => editInitialComponents.value.reduce((t, c) => {
  if (!c.published || !c.feeId) return t
  const a = scope.value === 'default'
    ? c.amount
    : (scopeComponentAmounts.value[c.feeId] !== undefined && scopeComponentAmounts.value[c.feeId] !== ''
        ? scopeComponentAmounts.value[c.feeId]
        : c.amount)
  return t + (parseFloat(String(a)) || 0)
}, 0))
const editInitialTotalLabel = computed(() => yen(editInitialTotal.value))

// Seed the pricing editor from the stored base version.
function seedPricingEdit(p: DetailProduct) {
  const baseV: PricingVersion = p.pricing?.[0] || {}
  editIsSubscription.value = baseV.isSubscription === undefined ? true : !!baseV.isSubscription
  editMonthly.value = baseV.monthly != null ? baseV.monthly : ''
  const src = baseV.components || []
  editInitialComponents.value = src.length
    ? src.map(c => ({ feeId: c.feeId || FEE_BASE_ID, published: c.published === undefined ? true : !!c.published, amount: c.amount }))
    : [{ feeId: FEE_BASE_ID, published: true, amount: '' }]
}

// ── version history ──
const AVATAR_COLORS = ['#00a155', '#2563eb', '#d97706', '#7c3aed', '#db2777']
function toggleHistoryEntry(id: string) {
  historyExpanded.value = { ...historyExpanded.value, [id]: !historyExpanded.value[id] }
}
const historyGroups = computed(() => {
  const now = new Date()
  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const fmtTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const initialsOf = (n: string) => n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()
  const groups: { label: string, entries: HistoryRow[] }[] = []
  historyEntries.value.forEach((entry, idx) => {
    const d = new Date(entry.ts)
    const label = isSameDay(d, now) ? 'TODAY' : fmtDate(d)
    let g = groups.find(x => x.label === label)
    if (!g) {
      g = { label, entries: [] }
      groups.push(g)
    }
    const expanded = !!historyExpanded.value[entry.id]
    const changes = entry.changes || []
    const isCurrent = idx === 0
    g.entries.push({
      id: entry.id,
      actor: entry.actor,
      initials: initialsOf(entry.actor),
      avatarStyle: `width:30px;height:30px;border-radius:999px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;background:${AVATAR_COLORS[idx % AVATAR_COLORS.length]};`,
      timestamp: fmtDate(d) + ' ' + fmtTime(d),
      isCurrent,
      rowStyle: `padding:10px 18px;border-bottom:1px solid #f1f5f9;${isCurrent ? 'border-left:3px solid #00c16a;background:#fbfffd;' : 'border-left:3px solid transparent;'}`,
      visibleChanges: expanded ? changes : changes.slice(0, 1),
      hasMore: changes.length > 1,
      toggleLabel: expanded ? 'Hide details' : `Show details (${changes.length})`,
      toggleIcon: expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'
    })
  })
  return groups
})
function diffChanges(before: DetailProduct, after: DetailProduct): HistoryChange[] {
  const out: HistoryChange[] = []
  const push = (field: string, a: unknown, b: unknown) => {
    const from = a == null ? '' : String(a)
    const to = b == null ? '' : String(b)
    if (from !== to) out.push({ field, from: from === '' ? '—' : from, to: to === '' ? '—' : to })
  }
  push('Name', before.name, after.name)
  push('Notes', before.notes, after.notes)
  push('Description', before.description, after.description)
  push('Category', before.category, after.category)
  push('Stock', before.stock === 'out_stock' ? 'Out of stock' : 'In stock', after.stock === 'out_stock' ? 'Out of stock' : 'In stock')
  push('Status', before.status, after.status)
  push('Mark as gift', before.notForSale ? 'Yes' : 'No', after.notForSale ? 'Yes' : 'No')
  const bp = (before.platformIds || []).join(', ')
  const ap = (after.platformIds || []).join(', ')
  if (bp !== ap) out.push({ field: 'Platforms', from: bp || '—', to: ap || '—' })
  return out
}

// ── mode transitions ──
function isDirty(): boolean {
  if (JSON.stringify(product.value) !== JSON.stringify(draft.value)) return true
  return editSnapshot !== JSON.stringify({ a: editAttributes.value, v: editVariants.value })
}
function onEditClick() {
  const seed = seedEditState(product.value)
  editSnapshot = JSON.stringify({ a: seed.attrs, v: seed.variants })
  const d: DetailProduct = { ...product.value }
  if (!d.categoryId && d.category) {
    const c = categoryByName(categories.value, d.category)
    if (c) d.categoryId = c.id
  }
  draft.value = d
  editAttributes.value = seed.attrs
  editVariants.value = seed.variants
  editAppliedKey.value = attrKey(seed.attrs)
  draftOverrides.value = JSON.parse(JSON.stringify(product.value.overrides || {}))
  seedPricingEdit(product.value)
  scope.value = 'default'
  mode.value = 'edit'
}
function onCancelClick() {
  if (isDirty()) {
    cancelConfirmOpen.value = true
  } else {
    mode.value = 'view'
  }
}
function onKeepEditing() {
  cancelConfirmOpen.value = false
}
function onConfirmDiscard() {
  const seed = seedEditState(product.value)
  draft.value = { ...product.value }
  editAttributes.value = seed.attrs
  editVariants.value = seed.variants
  editAppliedKey.value = attrKey(seed.attrs)
  cancelConfirmOpen.value = false
  scope.value = 'default'
  mode.value = 'view'
}

async function persist(merged: DetailProduct) {
  if (!isStored.value || !merged.id) return
  await apiUpdate<DetailProduct>('products', merged.id, merged)
}
async function onSaveClick(_event: FormSubmitEvent<ProductSchema>) {
  const d = draft.value
  const merged: DetailProduct = { ...d }
  if (isSinglePricing.value) {
    const comps = editInitialComponents.value
      .filter(c => c.feeId)
      .map(c => ({ feeId: c.feeId, published: !!c.published, amount: c.amount }))
    const initial = comps.reduce((t, c) => t + (c.published ? (parseFloat(String(c.amount)) || 0) : 0), 0)
    const existing: PricingVersion = d.pricing?.[0] || {}
    merged.pricing = [{
      ...existing,
      version: existing.version || 'v1',
      isSubscription: editIsSubscription.value,
      monthly: editIsSubscription.value ? editMonthly.value : '',
      initial,
      components: comps,
      active: existing.active !== undefined ? existing.active : true
    }, ...(d.pricing || []).slice(1)]
  }
  merged.platformIds = d.platformIds || []
  merged.platformNames = platformNamesOf(d.platformIds || [])
  const cleanOv: Overrides = {}
  Object.keys(draftOverrides.value).forEach((k) => {
    const o = draftOverrides.value[k]
    if (o && Object.keys(o).length) cleanOv[k] = o
  })
  merged.overrides = cleanOv
  merged.categoryPath = d.categoryId ? categoryPathById(categories.value, d.categoryId) : d.category
  if (product.value.hasVariants) {
    const cleanAttrs = editAttributes.value
      .filter(a => a.name.trim() && a.values.length > 0)
      .map(a => ({ name: a.name.trim(), values: [...a.values] }))
    merged.attributes = cleanAttrs
    merged.variants = regenerateVariants(editAttributes.value, editVariants.value)
      .map(v => ({ name: v.name, sku: v.sku, price: v.price, stock: v.stock, active: !!v.active, image: v.image || null }))
    // deviation from source: keep the denormalised count the Dashboard reads
    merged.variantCount = merged.variants.length
  }
  try {
    await persist(merged)
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Could not save the product.')
    return
  }
  const changes = diffChanges(product.value, merged)
  if (changes.length) {
    historyEntries.value = [{ id: 'h' + Date.now(), actor: 'Olivia Rhye', ts: Date.now(), changes }, ...historyEntries.value]
  }
  product.value = merged
  draft.value = { ...merged }
  mode.value = 'view'
  showToast('Product updated successfully')
}

// ── delete ──
function onDeleteClick() {
  deleteConfirmOpen.value = true
}
function onCancelDelete() {
  deleteConfirmOpen.value = false
}
async function onConfirmDelete() {
  if (isStored.value && product.value.id) {
    try {
      await apiRemove('products', product.value.id)
    } catch (err) {
      deleteConfirmOpen.value = false
      saveError.value = apiErrorMessage(err, 'Could not delete the product.')
      return
    }
  }
  deleteConfirmOpen.value = false
  toastMessage.value = 'Product deleted'
  deleteTimer = window.setTimeout(() => router.push('/dashboard'), 1200)
}
</script>

<template>
  <div class="form-compact mx-auto max-w-[1280px] px-8 pt-8 pb-20">
    <VertexErrorBanner :message="saveError" class="mb-4" />
    <VertexLoadingPanel v-if="loading" label="Loading product…" />

    <template v-else>
      <!-- header -->
      <div class="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <VertexBreadcrumb
            dense
            :items="[
              { label: 'Inventory', to: '/dashboard' },
              { label: 'Product', to: '/dashboard' },
              { label: product.name }
            ]"
          />
          <div class="flex items-center gap-2.5">
            <h1 class="text-2xl font-bold text-slate-900 m-0">
              {{ product.name }}
            </h1>
            <VertexStatusBadge :active="product.status === 'Active'" :label="product.status" />
          </div>
        </div>

        <div v-if="isViewMode" class="flex gap-2.5">
          <UButton
            variant="ghost"

            title="Version History"

            :ui="{ base: 'border border-slate-200 bg-white text-slate-700 w-10 h-10 rounded-lg cursor-pointer inline-flex items-center justify-center hover:bg-slate-50 transition-colors' }"
            @click="historyOpen = true"
          >
            <UIcon name="i-lucide-history" class="w-[17px] h-[17px]" />
          </UButton>
          <UButton
            variant="ghost"

            :ui="{ base: 'border border-red-200 bg-white text-red-600 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 hover:bg-red-50 transition-colors' }"
            @click="onDeleteClick"
          >
            <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" /> Delete
          </UButton>
          <UButton
            variant="ghost"

            :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 transition-colors' }"
            @click="onEditClick"
          >
            <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
          </UButton>
        </div>

        <div v-if="isEditMode" class="flex gap-2.5">
          <UButton
            variant="ghost"

            :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer hover:bg-slate-50 transition-colors' }"
            @click="onCancelClick"
          >
            Cancel
          </UButton>
          <UButton
            type="submit"
            form="product-detail"
            variant="ghost"

            :ui="{ base: 'border-none bg-green-500 text-white text-sm font-bold px-5 py-[9px] rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors' }"
          >
            Save Changes
          </UButton>
        </div>
      </div>

      <UForm
        id="product-detail"
        :schema="productSchema"
        :state="formState"
        class="flex flex-col gap-6"
        @submit="onSaveClick"
      >
        <!-- scope card -->
        <UCard v-if="showScopeCard" class="px-5 py-4">
          <div class="flex items-center gap-3.5 flex-wrap">
            <div class="flex items-center gap-2 flex-shrink-0">
              <UIcon name="i-lucide-layers" class="w-4 h-4 text-green-600" />
              <span class="text-sm font-bold text-slate-900">{{ isEditMode ? 'Editing for' : 'Viewing for' }}</span>
            </div>
            <div class="relative min-w-[260px]">
              <VertexSelectMenu
                :open="openDropdown === 'scope'"
                :label="scopeLabel"
                :items="scopeItems"
                max-height="260px"
                @toggle="toggleDropdown('scope')"
                @close="closeDropdown"
                @select="setScope"
              />
            </div>
            <span v-if="isPlatformScope" class="text-[12.5px] text-slate-500">Only <strong class="text-slate-700">Name</strong> and <strong class="text-slate-700">Price</strong> can be overridden here — other fields are global.</span>
            <span v-if="isViewPlatformScope" class="text-[12.5px] text-slate-500">Showing effective values for this platform. Click <strong class="text-slate-700">Edit</strong> to override them.</span>
          </div>
        </UCard>

        <!-- ROW 1: Core identification + Settings -->
        <div class="flex flex-wrap gap-6 items-stretch">
          <!-- Core identification -->
          <UCard class="h-full min-w-0 grow-[999] shrink basis-[380px] p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
              Core Identification
            </h2>
            <p class="text-[13px] text-slate-500 mt-0 mb-5">
              Basic details that identify this product.
            </p>

            <div class="grid gap-4 mb-4 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))]">
              <!-- name -->
              <div>
                <template v-if="isViewMode">
                  <span class="static-label">Product Name</span>
                  <div class="static-value">
                    {{ product.name }}
                  </div>
                </template>
                <template v-else>
                  <div class="flex items-center justify-between gap-2">
                    <label class="field-label mb-1.5">Product Name</label>
                    <span v-if="isPlatformScope" :style="nameHasOverride ? BADGE_OVERRIDE : BADGE_INHERIT">{{ nameHasOverride ? 'Overridden' : 'Inherited' }}</span>
                  </div>
                  <UFormField name="name" :ui="FORM_FIELD_COMPACT">
                    <UInput
                      :model-value="nameFieldValue"
                      placeholder="e.g. Tourist SIM 15GB"
                      :ui="fieldCompact()"
                      @update:model-value="onNameChange"
                    />
                  </UFormField>
                  <UButton
                    v-if="nameHasOverride"

                    variant="ghost"

                    :ui="{ base: 'mt-[5px] border-none bg-transparent text-green-600 text-xs font-semibold cursor-pointer p-0 inline-flex items-center gap-1' }"
                    @click="onNameReset"
                  >
                    <UIcon name="i-lucide-rotate-ccw" class="w-[11px] h-[11px]" /> Reset to default
                  </UButton>
                </template>
              </div>

              <!-- sku -->
              <div>
                <template v-if="isViewMode">
                  <span class="static-label">SKU</span>
                  <div class="static-value">
                    {{ product.sku }}
                  </div>
                </template>
                <template v-else>
                  <label class="field-label">SKU</label>
                  <UInput
                    :model-value="draft.sku"
                    disabled
                    title="SKU cannot be changed after creation"
                    :ui="fieldCompact()"
                  />
                  <div class="text-xs text-slate-400 mt-[5px] flex items-center gap-1">
                    <UIcon name="i-lucide-lock" class="w-[11px] h-[11px]" /> SKU cannot be changed after creation
                  </div>
                </template>
              </div>

              <!-- product type -->
              <div>
                <template v-if="isViewMode">
                  <span class="static-label">Product Type</span>
                  <div class="static-value capitalize">
                    {{ product.productType }}
                  </div>
                </template>
                <template v-else>
                  <label class="field-label">Product Type</label>
                  <UInput
                    :model-value="productTypeLabel"
                    disabled
                    title="Product type cannot be changed after creation"
                    :ui="fieldCompact()"
                  />
                  <div class="text-xs text-slate-400 mt-[5px] flex items-center gap-1">
                    <UIcon name="i-lucide-lock" class="w-[11px] h-[11px]" /> Product type cannot be changed after creation
                  </div>
                </template>
              </div>
            </div>

            <!-- notes -->
            <div class="mb-4">
              <template v-if="isViewMode">
                <span class="static-label">Notes</span>
                <div class="static-value font-normal text-slate-700 leading-normal">
                  {{ notesDisplay }}
                </div>
              </template>
              <template v-else>
                <label class="field-label">Notes</label>
                <UTextarea
                  :model-value="draft.notes"
                  :rows="3"
                  placeholder="Internal notes about this product..."
                  :ui="fieldCompact('resize-y')"
                  @update:model-value="draft.notes = String($event)"
                />
              </template>
            </div>

            <!-- image -->
            <div>
              <span class="static-label">Product Image</span>
              <img
                v-if="product.image"
                :src="product.image"
                class="w-[120px] h-[120px] rounded-[10px] object-cover border border-slate-200 block"
              >
              <div
                v-else
                class="w-24 h-24 rounded-[10px] bg-slate-100 flex items-center justify-center text-slate-300 border border-slate-100"
              >
                <UIcon name="i-lucide-image" class="w-[26px] h-[26px]" />
              </div>
            </div>
          </UCard>

          <!-- Settings -->
          <UCard class="h-full min-w-0 grow shrink basis-[320px] p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-5">
              Settings
            </h2>

            <!-- category -->
            <div class="mb-4">
              <template v-if="isViewMode">
                <span class="static-label">Category</span>
                <div class="static-value">
                  {{ categoryPathLabel }}
                </div>
              </template>
              <template v-else>
                <label class="field-label">Category</label>
                <div class="relative">
                  <VertexSelectMenu
                    :open="openDropdown === 'category'"
                    :label="catDisplay"
                    :placeholder="!hasCat"
                    :items="catFlat"
                    max-height="280px"
                    @toggle="toggleDropdown('category')"
                    @close="closeDropdown"
                    @select="pickCategory"
                  />
                </div>
              </template>
            </div>

            <!-- platforms -->
            <div class="mb-5">
              <template v-if="isViewMode">
                <span class="static-label">Platforms</span>
                <div v-if="viewPlatformNames.length" class="flex flex-wrap gap-1.5 mt-[5px]">
                  <span
                    v-for="pl in viewPlatformNames"
                    :key="pl"
                    class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-[11px] py-[3px]"
                  >
                    <UIcon name="i-lucide-globe" class="w-3 h-3 text-slate-400" />{{ pl }}
                  </span>
                </div>
                <div v-else class="static-value text-slate-400">
                  — No platform
                </div>
              </template>
              <template v-else>
                <label class="field-label">Platforms</label>
                <div v-if="editPlatformChips.length" class="flex flex-wrap gap-1.5 mb-2">
                  <span
                    v-for="chip in editPlatformChips"
                    :key="chip.id"
                    class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full py-1 pr-2 pl-3 text-[13px] font-semibold"
                  >
                    {{ chip.name }}
                    <UButton
                      variant="ghost"

                      title="Remove"

                      :ui="{ base: 'border-none bg-transparent cursor-pointer text-emerald-700 flex items-center p-0.5 rounded-full' }"
                      @click="removeDraftPlatform(chip.id)"
                    >
                      <UIcon name="i-lucide-x" class="w-3 h-3" />
                    </UButton>
                  </span>
                </div>
                <div class="relative">
                  <VertexSelectMenu
                    :open="openDropdown === 'platform'"
                    :label="platformAddLabel"
                    :items="platformItems"
                    max-height="220px"
                    @toggle="toggleDropdown('platform')"
                    @close="closeDropdown"
                    @select="addDraftPlatform"
                  >
                    <template #label>
                      <span class="text-slate-500">{{ platformAddLabel }}</span>
                    </template>
                    <template #empty>
                      <div v-if="platformAllAssigned" class="p-2.5 text-[13px] text-slate-400 text-center">
                        All platforms assigned
                      </div>
                    </template>
                  </VertexSelectMenu>
                </div>
              </template>
            </div>

            <!-- stock -->
            <div v-if="isViewMode" class="mb-4">
              <span class="static-label">Stock</span>
              <div class="static-value inline-flex items-center gap-2">
                <span :style="stockDotStyle" />{{ stockLabel }}
              </div>
            </div>
            <div
              v-else
              class="mb-5"
              :style="stockLocked ? 'opacity:0.6;pointer-events:none;' : ''"
            >
              <label class="field-label">Stock</label>
              <div class="relative">
                <VertexSelectMenu
                  :open="openDropdown === 'stock'"
                  :label="stockLabel"
                  :items="stockMenuItems"
                  :locked="stockLocked"
                  @toggle="onToggleStockDropdown"
                  @close="closeDropdown"
                  @select="pickStock"
                >
                  <template #label>
                    <span class="inline-flex items-center gap-2">
                      <span :style="stockDotStyle" />{{ stockLabel }}
                    </span>
                  </template>
                  <template #option="{ item }">
                    <span class="inline-flex items-center gap-2">
                      <span :style="stockDot(String(item.meta?.dot))" />{{ item.name }}
                    </span>
                  </template>
                </VertexSelectMenu>
              </div>
            </div>

            <!-- status -->
            <div class="flex items-center justify-between pt-4 border-t border-slate-100">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Status
                </div>
                <div class="text-[13px] text-slate-500 mt-0.5">
                  {{ statusHelper }}
                </div>
              </div>
              <VertexStatusBadge v-if="isViewMode" :active="product.status === 'Active'" :label="product.status" />
              <USwitch
                v-else
                :model-value="draftActive"
                class="shrink-0"
                @update:model-value="toggleStatus"
              />
            </div>

            <!-- not for sale -->
            <div class="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Mark as gift
                </div>
                <div class="text-[13px] text-slate-500 mt-0.5">
                  {{ notForSaleHelper }}
                </div>
              </div>
              <span v-if="isViewMode && product.notForSale" :style="notForSaleBadgeStyle">{{ notForSaleBadge }}</span>
              <span v-else-if="isViewMode" />
              <USwitch
                v-else
                :model-value="!!draft.notForSale"
                class="shrink-0"
                @update:model-value="toggleNotForSale"
              />
            </div>
          </UCard>
        </div>

        <!-- ROW 2: variants / bundle -->
        <div class="flex flex-wrap gap-6">
          <div class="grow-[999] shrink basis-[420px] min-w-0 flex flex-col gap-6">
            <!-- VARIANTS -->
            <UCard v-if="isVariantProduct" class="p-6">
              <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
                Variants
              </h2>
              <p class="text-[13px] text-slate-500 mt-0 mb-5">
                Define attributes, then generate variant combinations.
              </p>

              <!-- EDIT MODE -->
              <div v-if="isEditMode">
                <div class="flex items-center gap-2 mb-3.5">
                  <span class="w-[22px] h-[22px] rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <span class="text-sm font-bold text-slate-900">Define Attributes</span>
                </div>

                <div class="flex flex-col gap-3 mb-3">
                  <div
                    v-for="attr in editAttrRows"
                    :key="attr.id"
                    class="border border-slate-200 rounded-[10px] px-4 py-3.5 bg-slate-50"
                  >
                    <div class="flex flex-wrap gap-3 items-start">
                      <div class="basis-[150px] grow shrink min-w-[120px] max-w-[240px]">
                        <label class="field-label text-xs">Attribute Name</label>
                        <div class="select-wrap">
                          <USelect
                            :model-value="attr.name || undefined"
                            :items="attributeTypeOptions"
                            placeholder="Select attribute..."
                            :ui="fieldCompact()"
                            @update:model-value="onAttrNameChange(attr.id, String($event))"
                          />
                        </div>
                      </div>
                      <div class="basis-[170px] grow shrink min-w-0">
                        <label class="field-label text-xs">Values</label>
                        <div class="flex flex-wrap gap-1.5 items-center">
                          <span
                            v-for="chip in attr.valueChips"
                            :key="chip"
                            class="inline-flex basis-auto grow-0 shrink-0 items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full py-[3px] pr-1.5 pl-2.5 text-[13px] font-medium"
                          >
                            {{ chip }}
                            <UButton
                              variant="ghost"

                              :ui="{ base: 'border-none bg-transparent cursor-pointer text-emerald-700 flex items-center p-0.5 rounded-full' }"
                              @click="removeAttrValue(attr.id, chip)"
                            >
                              <UIcon name="i-lucide-x" class="w-3 h-3" />
                            </UButton>
                          </span>
                          <div v-if="attr.canAddValue" class="select-wrap basis-[130px] grow shrink min-w-[120px]">
                            <USelect
                              :model-value="NO_VALUE"
                              :items="attr.valueOptions"
                              placeholder="+ Add value"
                              :ui="SELECT_ADD_VALUE"
                              @update:model-value="addAttrValue(attr.id, String($event))"
                            />
                          </div>
                          <span v-if="attr.noValueOptions" class="text-xs text-slate-400 p-1">{{ attr.valuesEmptyHint }}</span>
                        </div>
                      </div>
                      <UButton
                        variant="ghost"

                        title="Remove attribute"

                        :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-500 w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0 mt-5' }"
                        @click="removeEditAttr(attr.id)"
                      >
                        <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                      </UButton>
                    </div>
                  </div>
                </div>

                <UButton
                  variant="ghost"

                  :ui="{ base: 'inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer mb-7 mr-2.5' }"
                  @click="addEditAttribute"
                >
                  <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
                  Add Attribute
                </UButton>
                <UButton
                  variant="ghost"

                  :disabled="editApplyDisabled"

                  :ui="{ base: ['inline-flex items-center gap-1.5 border-none text-[13px] font-bold px-[18px] py-[9px] rounded-lg mb-7 transition-colors', editApplyDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white cursor-pointer shadow-sm hover:bg-green-600'] }"
                  @click="applyEditVariants"
                >
                  <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
                  Apply
                </UButton>

                <div class="flex items-center justify-between mb-3.5">
                  <div class="flex items-center gap-2">
                    <span class="w-[22px] h-[22px] rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <span class="text-sm font-bold text-slate-900">Variant Combinations</span>
                    <span class="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{{ variantCountLabel }}</span>
                  </div>
                </div>

                <div class="border border-slate-200 rounded-[10px] overflow-hidden">
                  <div class="overflow-x-auto">
                    <div class="min-w-[420px]">
                      <div class="grid grid-cols-[minmax(140px,1.4fr)_130px_80px_40px] gap-2 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                        <span class="th text-xs">Variant</span>
                        <span class="th text-xs">SKU</span>
                        <span class="th text-xs text-center">Status</span>
                        <span />
                      </div>
                      <div
                        v-for="ev in editVariants"
                        :key="ev.name"
                        class="grid grid-cols-[minmax(140px,1.4fr)_130px_80px_40px] gap-2 items-center px-4 py-2 border-b border-slate-100"
                      >
                        <span class="text-sm font-semibold text-slate-900">{{ ev.name }}</span>
                        <UInput
                          :model-value="ev.sku"
                          placeholder="SKU"
                          :ui="fieldCompactSm()"
                          @update:model-value="updateEditVariant(ev.name, 'sku', String($event))"
                        />
                        <div class="text-center">
                          <USwitch
                            :model-value="!!ev.active"
                            class="inline-flex"
                            @update:model-value="updateEditVariant(ev.name, 'active', $event)"
                          />
                        </div>
                        <UButton
                          variant="ghost"

                          title="Delete variant"

                          :ui="{ base: 'hover:bg-slate-100 border-none bg-transparent text-slate-400 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                          @click="removeEditVariant(ev.name)"
                        >
                          <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                        </UButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- VIEW MODE -->
              <div v-else>
                <div class="flex items-center gap-2 mb-3.5">
                  <span class="text-sm font-bold text-slate-900">Variant Combinations</span>
                  <span class="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{{ variantCountLabel }}</span>
                </div>
                <div class="border border-slate-200 rounded-[10px] overflow-hidden">
                  <div class="overflow-x-auto">
                    <UTable
                      :data="viewVariantRows"
                      :columns="viewVariantColumns"
                      :ui="{
                        ...tableUi('min-w-[640px]'),
                        th: 'th text-left text-xs px-3 py-[11px]',
                        td: 'px-3 py-[11px]'
                      }"
                    >
                      <template #name-cell="{ row }">
                        <span class="text-sm font-semibold text-slate-900">{{ row.original.name }}</span>
                      </template>

                      <template #skuLabel-cell="{ row }">
                        <span class="text-[13px] text-slate-500">{{ row.original.skuLabel }}</span>
                      </template>

                      <template #attrChips-cell="{ row }">
                        <div class="flex flex-wrap gap-[5px]">
                          <span
                            v-for="ac in row.original.attrChips"
                            :key="ac"
                            class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                          >{{ ac }}</span>
                        </div>
                      </template>

                      <template #priceLabel-cell="{ row }">
                        <span class="text-sm text-slate-700">{{ row.original.priceLabel }}</span>
                      </template>

                      <template #stockLabel-cell="{ row }">
                        <span class="text-sm text-slate-700">{{ row.original.stockLabel }}</span>
                      </template>

                      <template #statusLabel-cell="{ row }">
                        <VertexStatusBadge :active="row.original.statusLabel === 'Active'" :label="row.original.statusLabel" />
                      </template>

                      <template #action-cell="{ row }">
                        <div class="text-right">
                          <NuxtLink
                            :to="row.original.detailTo"
                            class="hover:bg-slate-100 inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold px-3 py-1.5 rounded-lg no-underline"
                          >
                            <UIcon name="i-lucide-eye" class="w-3.5 h-3.5" /> View Detail
                          </NuxtLink>
                        </div>
                      </template>
                    </UTable>
                  </div>
                </div>
              </div>
            </UCard>

            <!-- BUNDLE -->
            <UCard v-if="isBundleProduct" class="p-6">
              <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
                Bundle
              </h2>
              <p class="text-[13px] text-slate-500 mt-0 mb-4">
                Components and their products in this bundle.
              </p>
              <div v-if="bundleComponentRows.length" class="flex flex-col gap-4">
                <div
                  v-for="(comp, ci) in bundleComponentRows"
                  :key="ci"
                  class="border border-slate-200 rounded-[10px] p-4 bg-slate-50"
                >
                  <div class="text-sm font-bold text-slate-900 mb-3">
                    {{ comp.title }}
                  </div>
                  <div class="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(min(220px,100%),1fr))]">
                    <div
                      v-for="(prod, pi) in comp.products"
                      :key="pi"
                      class="border border-slate-200 rounded-lg bg-white px-3.5 py-3 flex items-center gap-2.5"
                    >
                      <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                        <UIcon name="i-lucide-package" class="w-[17px] h-[17px]" />
                      </div>
                      <div class="min-w-0">
                        <div class="text-[13.5px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                          {{ prod.name }}
                        </div>
                        <div class="text-xs text-slate-500">
                          {{ prod.sku }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-else
                class="border-[1.5px] border-dashed border-slate-200 rounded-[10px] px-6 py-10 text-center"
              >
                <div class="text-sm text-slate-400">
                  No components in this bundle.
                </div>
              </div>
            </UCard>

            <!-- PRICING (single / bundle) -->
            <UCard v-if="isSinglePricing" class="p-6">
              <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
                Pricing
              </h2>
              <p class="text-[13px] text-slate-500 mt-0 mb-5">
                Subscription, monthly fee and initial fee components.
              </p>

              <!-- view mode -->
              <template v-if="isViewMode">
                <div class="flex flex-wrap gap-3 mb-5">
                  <div class="basis-[180px] grow shrink min-w-0 border border-slate-200 rounded-[10px] px-4 py-3.5">
                    <div class="th text-xs mb-1.5">
                      Subscription
                    </div>
                    <div class="text-sm text-slate-900">
                      {{ viewSubscriptionLabel }}
                    </div>
                  </div>
                  <div v-if="viewIsSubscription" class="basis-[140px] grow shrink min-w-0 border border-slate-200 rounded-[10px] px-4 py-3.5">
                    <div class="th text-xs mb-1.5">
                      Monthly Fee
                    </div>
                    <div class="text-sm text-slate-900">
                      {{ viewMonthlyLabel }}
                    </div>
                  </div>
                  <div class="basis-[140px] grow shrink min-w-0 border border-slate-200 rounded-[10px] px-4 py-3.5">
                    <div class="th text-xs mb-1.5">
                      Initial Fee
                    </div>
                    <div class="text-sm text-slate-900">
                      {{ initialBreakdownTotal }}
                    </div>
                  </div>
                </div>

                <div v-if="hasInitialBreakdown" class="border border-slate-200 rounded-[10px] overflow-hidden">
                  <div class="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span class="th flex-1 text-xs">Component</span>
                    <span class="th w-[150px] text-xs text-right">Amount</span>
                  </div>
                  <div
                    v-for="b in initialBreakdown"
                    :key="b.feeId"
                    class="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100"
                  >
                    <span class="flex-1 text-sm text-slate-900">{{ b.label }}</span>
                    <span class="w-[150px] text-sm text-slate-700 text-right">{{ b.amountLabel }}</span>
                  </div>
                  <div class="flex items-center justify-between px-3.5 py-3 bg-slate-50">
                    <span class="text-sm font-bold text-slate-900">Initial Fee (Total)</span>
                    <span class="text-base font-bold text-slate-900">{{ initialBreakdownTotal }}</span>
                  </div>
                </div>
                <div
                  v-else
                  class="border-[1.5px] border-dashed border-slate-200 rounded-[10px] px-6 py-7 text-center text-sm text-slate-400"
                >
                  No initial fee components.
                </div>
              </template>

              <!-- edit mode -->
              <template v-else>
                <div class="flex items-center justify-between gap-3 px-3.5 py-3 border border-slate-200 rounded-[10px] mb-5 bg-slate-50">
                  <div>
                    <div class="text-sm font-semibold text-slate-900">
                      Subscription product
                    </div>
                    <div class="text-[13px] text-slate-500 mt-0.5">
                      {{ subscriptionHelper }}
                    </div>
                  </div>
                  <div class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                    <UIcon name="i-lucide-lock" class="w-3 h-3" />{{ editSubscriptionLabel }}
                  </div>
                </div>

                <div v-if="editIsSubscription" class="mb-5 max-w-[320px]">
                  <label class="field-label">Monthly Fee</label>
                  <div class="relative">
                    <span class="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm text-slate-400">¥</span>
                    <UInput
                      :model-value="String(editMonthly)"
                      type="number"
                      placeholder="0.00"
                      :ui="fieldCompact('pl-[26px]')"
                      @update:model-value="editMonthly = String($event)"
                    />
                  </div>
                </div>

                <div>
                  <div class="flex items-baseline gap-2 mb-2">
                    <label class="field-label mb-0">Initial Fee</label>
                    <span class="text-xs text-slate-400">sum of published components below.</span>
                  </div>

                  <div
                    v-if="feeComponentsLocked"
                    class="flex items-center gap-2 mb-2.5 text-[12.5px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <UIcon name="i-lucide-lock" class="w-[13px] h-[13px] flex-shrink-0" />
                    <span>Components and publish states are set in Default scope. Here you can override amounts for this platform.</span>
                  </div>

                  <div class="border border-slate-200 rounded-[10px] overflow-hidden">
                    <div class="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                      <span class="th flex-1 min-w-0 text-xs">Component</span>
                      <span class="th w-[150px] flex-shrink-0 text-xs">Amount</span>
                      <span class="th w-24 flex-shrink-0 text-center text-xs">Published</span>
                      <span class="w-[38px] flex-shrink-0" />
                    </div>

                    <div
                      v-for="c in editComponentRows"
                      :key="c.index"
                      class="flex items-center gap-2.5 px-3 py-2.5 border-b border-slate-100"
                      :class="c.dimmed ? 'bg-neutral-50 opacity-70' : ''"
                    >
                      <div class="flex-1 min-w-0">
                        <div v-if="c.locked" class="flex items-center gap-2 text-sm font-semibold text-slate-900 py-0.5">
                          {{ c.name }}
                          <span class="text-[11px] font-semibold px-2 py-px rounded-full bg-blue-50 text-blue-600 border border-blue-200">Base</span>
                        </div>
                        <div v-else class="select-wrap">
                          <USelect
                            :model-value="c.feeId || undefined"
                            :items="c.options"
                            value-key="id"
                            label-key="name"
                            :disabled="c.selectDisabled"
                            placeholder="Select component..."
                            :ui="fieldCompact()"
                            @update:model-value="setComponentFee(c.index, String($event))"
                          />
                        </div>
                      </div>

                      <div class="relative w-[150px] flex-shrink-0">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm text-slate-400">¥</span>
                        <UInput
                          :model-value="String(c.amount)"
                          type="number"
                          placeholder="0"
                          :ui="fieldCompact('pl-[26px]')"
                          @change="setComponentAmount(c.index, ($event.target as HTMLInputElement).value)"
                        />
                      </div>

                      <div class="w-24 flex-shrink-0 flex justify-center">
                        <USwitch
                          :model-value="!!c.published"
                          :disabled="c.publishLocked"
                          :title="c.publishTitle"
                          :ui="{ root: c.publishLocked ? 'opacity-60' : '' }"
                          @update:model-value="toggleComponentPublish(c.index)"
                        />
                      </div>

                      <div class="w-[38px] flex-shrink-0">
                        <UButton
                          v-if="c.canRemove"

                          variant="ghost"
                          title="Remove component"

                          :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-500 w-[38px] h-[38px] rounded-lg cursor-pointer flex items-center justify-center' }"
                          @click="removeComponent(c.index)"
                        >
                          <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                        </UButton>
                        <span
                          v-else-if="c.locked"
                          class="w-[38px] h-[38px] inline-flex items-center justify-center text-slate-300"
                        >
                          <UIcon name="i-lucide-lock" class="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>

                    <div v-if="canAddEditComponent" class="px-3 py-2.5 border-b border-slate-100">
                      <UButton
                        variant="ghost"

                        :ui="{ base: 'inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-3.5 py-2 rounded-lg cursor-pointer' }"
                        @click="addEditComponent"
                      >
                        <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> Add component
                      </UButton>
                    </div>

                    <div class="flex items-center justify-between px-3.5 py-3 bg-slate-50">
                      <span class="text-sm font-bold text-slate-900">Initial Fee (Total)</span>
                      <span class="text-base font-bold text-slate-900">{{ editInitialTotalLabel }}</span>
                    </div>
                  </div>
                </div>
              </template>
            </UCard>
          </div>
          <div
            v-if="showLowerSpacer"
            class="grow shrink basis-[320px]"
            aria-hidden="true"
          />
        </div>
      </UForm>

      <!-- cancel confirm -->
      <VertexConfirmModal
        :open="cancelConfirmOpen"
        compact
        icon=""
        title="Discard changes?"
        message="Your edits will not be saved."
        cancel-label="Keep Editing"
        confirm-label="Discard"
        width-class="w-[420px]"
        @cancel="onKeepEditing"
        @confirm="onConfirmDiscard"
      />

      <!-- delete confirm -->
      <VertexConfirmModal
        :open="deleteConfirmOpen"
        compact
        icon="triangle-alert"
        :title="`Delete ${product.name}?`"
        message="This action cannot be undone."
        cancel-label="Cancel"
        confirm-label="Delete"
        @cancel="onCancelDelete"
        @confirm="onConfirmDelete"
      />

      <!-- toast -->
      <VertexToast :message="toastMessage" variant="dark" />

      <!-- version history drawer -->
      <template v-if="historyOpen">
        <div
          class="fixed inset-0 bg-slate-900/35 backdrop-blur-[2px] z-[120]"
          @click="historyOpen = false"
        />
        <div class="drawer fixed top-0 right-0 bottom-0 w-[340px] max-w-[92vw] bg-white z-[121] shadow-[-8px_0_30px_rgba(0,0,0,0.18)] flex flex-col">
          <div class="flex items-center justify-between gap-3 px-[18px] py-3.5 border-b border-slate-200 flex-shrink-0">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-history" class="w-4 h-4 text-green-600" />
              <h2 class="text-[15px] font-bold text-slate-900 m-0">
                Version History
              </h2>
            </div>
            <UButton
              variant="ghost"

              :ui="{ base: 'hover:bg-slate-100 border-none bg-transparent text-slate-500 w-[30px] h-[30px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
              @click="historyOpen = false"
            >
              <UIcon name="i-lucide-x" class="w-[17px] h-[17px]" />
            </UButton>
          </div>
          <div class="flex-1 overflow-y-auto pt-0.5 pb-4">
            <template v-for="g in historyGroups" :key="g.label">
              <div class="px-[18px] pt-3 pb-1 text-[10px] font-bold tracking-[0.05em] text-slate-400 uppercase">
                {{ g.label }}
              </div>
              <div v-for="e in g.entries" :key="e.id" :style="e.rowStyle">
                <div class="flex items-start gap-2.5">
                  <div :style="e.avatarStyle">
                    {{ e.initials }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="text-sm font-semibold text-slate-900">{{ e.actor }}</span>
                      <span
                        v-if="e.isCurrent"
                        class="text-[11px] font-bold text-green-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-px"
                      >Current version</span>
                    </div>
                    <div class="text-[11px] text-slate-400 mt-px">
                      {{ e.timestamp }}
                    </div>
                    <div class="mt-1.5 flex flex-col gap-1">
                      <div v-for="(c, idx) in e.visibleChanges" :key="idx" class="text-[13px] text-slate-700">
                        <span class="font-semibold">{{ c.field }}:</span>
                        <span class="text-slate-400 line-through">{{ c.from }}</span>
                        <UIcon name="i-lucide-arrow-right" class="w-[11px] h-[11px] inline align-middle text-slate-300 mx-0.5" />
                        <span class="text-slate-900 font-medium">{{ c.to }}</span>
                      </div>
                    </div>
                    <UButton
                      v-if="e.hasMore"

                      variant="ghost"

                      :ui="{ base: 'border-none bg-transparent text-green-600 text-xs font-semibold cursor-pointer pt-1.5 px-0 pb-0 inline-flex items-center gap-1' }"
                      @click="toggleHistoryEntry(e.id)"
                    >
                      {{ e.toggleLabel }}
                      <UIcon :name="e.toggleIcon" class="w-3 h-3" />
                    </UButton>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
