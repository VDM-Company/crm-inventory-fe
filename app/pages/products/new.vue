<script setup lang="ts">
import type {
  AttributeDef,
  Category,
  Fee,
  Platform,
  ProductType,
  StoredProduct
} from '~/types'

useHead({ title: 'Create New Product — Vertex' })

const router = useRouter()

// Seed catalog for the Bundle component picker (design's SEED_CATALOG).
const SEED_CATALOG = [
  { id: 'c2000', name: 'Tourist SIM 15GB', sku: 'SKU-2000' },
  { id: 'c2001', name: 'Business eSIM Pro', sku: 'SKU-2001' },
  { id: 'c2002', name: 'Pocket WiFi Router X1', sku: 'SKU-2002' },
  { id: 'c2003', name: 'Unlimited Data Plan 30D', sku: 'SKU-2003' },
  { id: 'c2004', name: 'Prepaid Data Plan 7D', sku: 'SKU-2004' },
  { id: 'c2005', name: 'eSIM Global 5GB', sku: 'SKU-2005' }
]

// ── local shapes ──
interface AttrRow { id: string, name: string, values: string[] }
interface VariantRow { key: string, name: string, sku: string, price: string, stock: string, active: boolean, image?: string }
interface InitialComponent { feeId: string, published: boolean, amount: string }
interface BundleComponentModel { id: string, name: string, products: { id: string, name: string, sku: string }[] }
interface ComponentModalState { name: string, rows: { id: string, productId: string }[], editingId: string | null }

// ── form + view state (mirrors the design's DCLogic state) ──
const form = reactive({
  name: '',
  sku: '',
  notes: '',
  description: '',
  category: '',
  categoryId: '',
  platformIds: [] as string[],
  image: null as string | null,
  imageName: '',
  priceMonthly: '',
  stock: 'in_stock',
  initialComponents: [
    { feeId: 'fee_base', published: true, amount: '' },
    { feeId: 'fee_tax', published: true, amount: '' },
    { feeId: 'fee_shipping', published: true, amount: '' }
  ] as InitialComponent[]
})

const productType = ref<ProductType>('single')
const isSubscription = ref(true)
const published = ref(false)
const notForSale = ref(false)
const openDropdown = ref<string | null>(null)

// inline edit affordance on Monthly Fee: focusing the field snapshots the
// current value so Cancel can revert it.
const pricingEditing = ref(false)
const pricingSnapshot = ref('')

const attributes = ref<AttrRow[]>([])
const variants = ref<VariantRow[]>([])
const bundleComponents = ref<BundleComponentModel[]>([])
const componentModal = ref<ComponentModalState | null>(null)

const saveConfirmOpen = ref(false)
const cancelConfirmOpen = ref(false)
const savedToast = ref(false)
const saveError = ref<string[] | null>(null)
const formDirty = ref(false)
// snapshot of the attributes last "applied" — variant combinations only
// regenerate when the user clicks Apply (design no longer auto-regenerates).
const appliedKey = ref('')

// masters — fees seeded deterministically so the pre-selected Pricing rows
// render identically on server + first client paint; the rest follow the
// Dashboard pattern (empty until `onMounted` reads localStorage).
const categories = ref<Category[]>([])
const platforms = ref<Platform[]>([])
const attributeDefs = ref<AttributeDef[]>([])
const fees = ref<Fee[]>([...FEE_SEED])

const prodImageInput = ref<HTMLInputElement | null>(null)
let toastTimer: number | null = null

const hasVariants = computed(() => productType.value === 'variant')
const isBundle = computed(() => productType.value === 'bundle')

onMounted(() => {
  categories.value = loadCategories()
  platforms.value = loadPlatforms()
  attributeDefs.value = loadAttributeDefs()
  fees.value = loadFees()
})

onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

// any user edit marks the form dirty (guards the Cancel confirm) and clears a
// stale "missing fields" banner (the design clears it inside every setter)
watch(
  [() => form, productType, isSubscription, published, notForSale, attributes, variants, bundleComponents],
  () => {
    formDirty.value = true
    saveError.value = null
  },
  { deep: true }
)

// ── shared inline-style helpers (ported from the design) ──
function ddTrigger(open: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid ${open ? '#00c16a' : '#e2e8f0'};border-radius:8px;padding:9px 12px;height:40px;font-size:14px;background:#fff;cursor:pointer;color:#0f172a;${open ? 'box-shadow:0 0 0 3px rgba(0,193,106,0.15);' : ''}`
}
function ddChevron(open: boolean) {
  return `display:inline-flex;align-items:center;color:#64748b;flex-shrink:0;transition:transform 150ms ease;transform:rotate(${open ? '180deg' : '0deg'});`
}
function ddOption(selected: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;font-size:14px;color:${selected ? '#047857' : '#334155'};font-weight:${selected ? 600 : 400};cursor:pointer;`
}
function trackStyle(active: boolean) {
  return `width:40px;height:22px;border-radius:999px;border:none;cursor:pointer;background:${active ? '#00c16a' : '#e2e8f0'};position:relative;padding:2px;display:inline-flex;align-items:center;transition:background 150ms ease;flex-shrink:0;`
}
function knobStyle(active: boolean) {
  return `width:18px;height:18px;border-radius:999px;background:#fff;display:block;box-shadow:0 1px 2px rgba(0,0,0,0.15);transform:translateX(${active ? '18px' : '0px'});transition:transform 150ms ease;`
}
function switchTrackCss(on: boolean, locked: boolean) {
  return `width:40px;height:22px;border-radius:999px;border:none;background:${on ? '#00c16a' : '#e2e8f0'};position:relative;padding:2px;display:inline-flex;align-items:center;transition:background 150ms ease;cursor:${locked ? 'not-allowed' : 'pointer'};${locked ? 'opacity:0.65;' : ''}`
}
function switchKnobCss(on: boolean) {
  return `width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.15);transform:translateX(${on ? '18px' : '0px'});transition:transform 150ms ease;display:block;`
}

function toggleDropdown(key: string) {
  openDropdown.value = openDropdown.value === key ? null : key
}
function closeDropdown() {
  openDropdown.value = null
}

// ── core identification ──
function setType(type: ProductType) {
  productType.value = type
  closeDropdown()
  if (type === 'variant') {
    regenerate()
    // carry a single-product monthly price into the first variant row
    const carry = form.priceMonthly
    if (carry !== '' && carry != null && variants.value.length && (variants.value[0]!.price === '' || variants.value[0]!.price == null)) {
      variants.value = variants.value.map((v, i) => i === 0 ? { ...v, price: carry } : v)
    }
  }
}
const productTypeLabel = computed(() => ({ single: 'Single', variant: 'Variant', bundle: 'Bundle' })[productType.value] || 'Single')
const productTypeItems = computed(() =>
  ([['single', 'Single'], ['variant', 'Variant'], ['bundle', 'Bundle']] as [ProductType, string][])
    .map(([value, name]) => ({ value, name, selected: productType.value === value }))
)

function readImageFile(file: File) {
  if (!file.type || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = (ev) => {
    form.image = String(ev.target?.result || '')
    form.imageName = file.name
  }
  reader.readAsDataURL(file)
}
function onBrowseImage() {
  if (prodImageInput.value) {
    prodImageInput.value.value = ''
    prodImageInput.value.click()
  }
}
function onImageChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files && files[0]) readImageFile(files[0])
}
function onDropImage(e: DragEvent) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (files && files[0]) readImageFile(files[0])
}
function onRemoveImage() {
  form.image = null
  form.imageName = ''
}

// ── settings: category / platforms / stock / status ──
const categoryDisplay = computed(() =>
  form.categoryId ? categoryPathById(categories.value, form.categoryId) : (form.category || 'Select category')
)
const categoryFlat = computed(() =>
  flattenCategories(categories.value).map((o) => {
    const selected = o.id === form.categoryId
    // parent rows read bolder than leaves, but every row stays selectable
    const style = `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;padding-left:${o.depth ? (10 + o.depth * 16) : 10}px;font-size:14px;color:${selected ? '#047857' : '#0f172a'};font-weight:${selected ? 600 : (o.header ? 600 : 400)};cursor:pointer;`
    return { id: o.id, name: o.name, selected, style }
  })
)
function pickCategory(id: string) {
  const cat = categoryById(categories.value, id)
  if (!cat) return
  form.categoryId = id
  form.category = cat.name
  saveError.value = null
  closeDropdown()
}

const assignedPlatformChips = computed(() =>
  form.platformIds
    .map(id => platformById(platforms.value, id))
    .filter((p): p is Platform => !!p)
    .map(p => ({ id: p.id, name: p.name }))
)
const availablePlatforms = computed(() =>
  platforms.value.filter(p => form.platformIds.indexOf(p.id) === -1)
)
const platformAllAssigned = computed(() => platforms.value.length > 0 && availablePlatforms.value.length === 0)
const platformAddLabel = computed(() => assignedPlatformChips.value.length ? 'Add another platform' : 'Add platform')
function addPlatform(id: string) {
  form.platformIds = [...form.platformIds, id]
  closeDropdown()
  saveError.value = null
}
function removePlatform(id: string) {
  form.platformIds = form.platformIds.filter(x => x !== id)
}

const stockLabel = computed(() => form.stock === 'out_stock' ? 'Out of Stock' : 'In Stock')
function stockDot(colour: string) {
  return `width:8px;height:8px;border-radius:999px;flex-shrink:0;background:${colour};`
}
const stockItems: [string, string, string][] = [
  ['in_stock', 'In Stock', '#00c16a'],
  ['out_stock', 'Out of Stock', '#dc2626']
]
function pickStock(value: string) {
  form.stock = value
  closeDropdown()
}

// ── variant attribute builder ──
function addAttribute() {
  attributes.value = [...attributes.value, { id: 'attr_' + Date.now(), name: '', values: [] }]
}
function removeAttribute(id: string) {
  attributes.value = attributes.value.filter(a => a.id !== id)
}
function onAttributeSelect(id: string, name: string) {
  attributes.value = attributes.value.map(a => a.id === id ? { ...a, name, values: [] } : a)
}
function addAttributeValue(id: string, value: string) {
  if (!value) return
  attributes.value = attributes.value.map(a =>
    a.id === id && a.values.indexOf(value) === -1 ? { ...a, values: [...a.values, value] } : a
  )
}
function onPickValue(id: string, e: Event) {
  const el = e.target as HTMLSelectElement
  addAttributeValue(id, el.value)
  el.value = ''
}
function removeAttributeValue(id: string, value: string) {
  attributes.value = attributes.value.map(a =>
    a.id === id ? { ...a, values: a.values.filter(v => v !== value) } : a
  )
}
// Checkbox-type attributes pick many values, radio-type exactly one.
function toggleAttributeValue(id: string, value: string) {
  attributes.value = attributes.value.map(a =>
    a.id === id
      ? { ...a, values: a.values.indexOf(value) !== -1 ? a.values.filter(v => v !== value) : [...a.values, value] }
      : a
  )
}
function pickAttributeValue(id: string, value: string) {
  attributes.value = attributes.value.map(a => a.id === id ? { ...a, values: [value] } : a)
}

const attributeRows = computed(() =>
  attributes.value.map((a) => {
    const options = attributeAvailableFor(attributeDefs.value, a.name, a.values)
    // attribute names already used by another row are shown disabled
    const typeOptions = attributeNames(attributeDefs.value).map((opt) => {
      const usedElsewhere = attributes.value.some(x => x.id !== a.id && x.name === opt)
      return { value: opt, label: usedElsewhere ? opt + ' (already used)' : opt, disabled: usedElsewhere }
    })
    // The Attributes page's input type picks which value editor renders here.
    const attrType = a.name ? attributeTypeFor(attributeDefs.value, a.name) : 'Select'
    const presets = a.name ? attributeValuesFor(attributeDefs.value, a.name) : []
    return {
      id: a.id,
      name: a.name,
      typeOptions,
      noAttr: !a.name,
      isCheckbox: !!a.name && attrType === 'Checkbox',
      isRadio: !!a.name && attrType === 'Radio',
      isSelectValue: !!a.name && attrType === 'Select',
      radioName: 'attr_radio_' + a.id,
      noChoices: !!a.name && presets.length === 0,
      choices: presets.map(v => ({ label: v, checked: a.values.indexOf(v) !== -1 })),
      valueChips: a.values,
      availableValues: options,
      canAddValue: !!a.name && options.length > 0,
      allSelected: !!a.name && presets.length > 0 && options.length === 0
    }
  })
)

// Variant combinations regenerate only on Apply (not on every edit).
const attrSignature = () => JSON.stringify(attributes.value.map(a => ({ name: a.name, values: a.values })))
const applyDisabled = computed(() => {
  const valid = attributes.value.some(a => a.name && a.name.trim() && a.values.length > 0)
  if (!valid) return true
  return attrSignature() === appliedKey.value
})
function applyVariants() {
  regenerate()
}

function regenerate() {
  appliedKey.value = attrSignature()
  const attrs = attributes.value.filter(a => a.name.trim() && a.values.length > 0)
  if (attrs.length === 0) {
    variants.value = []
    return
  }
  let combos: string[][] = [[]]
  attrs.forEach((a) => {
    const next: string[][] = []
    combos.forEach(c => a.values.forEach(v => next.push([...c, v])))
    combos = next
  })
  const base = (form.sku || '').trim().toUpperCase()
  const skuFor = (combo: string[]) => (base ? base + '-' : '') + combo.map(v => String(v).toUpperCase().replace(/\s+/g, '')).join('-')
  const existing: Record<string, VariantRow> = {}
  variants.value.forEach((v) => {
    existing[v.key] = v
  })
  variants.value = combos.map((combo) => {
    const key = combo.join(' / ')
    return existing[key] || { key, name: key, sku: skuFor(combo), price: '', stock: '', active: true }
  })
}

function updateVariant(key: string, field: 'sku' | 'price' | 'stock' | 'image', value: string) {
  variants.value = variants.value.map(v => v.key === key ? { ...v, [field]: value } : v)
}
function removeVariant(key: string) {
  variants.value = variants.value.filter(v => v.key !== key)
}
function toggleVariantActive(key: string) {
  variants.value = variants.value.map(v => v.key === key ? { ...v, active: !v.active } : v)
}
const variantCountLabel = computed(() =>
  variants.value.length === 1 ? '1 variant' : variants.value.length + ' variants'
)

// ── bundle components ──
function bundleComponentTitle(name: string) {
  const n = (name || '').trim()
  return /component$/i.test(n) ? n : (n + ' Component')
}
function getCatalog() {
  let stored: { id: string, name: string, sku: string }[] = []
  try {
    stored = JSON.parse(localStorage.getItem('vertex_products') || '[]')
  } catch {
    // ignore malformed storage
  }
  return stored.map(p => ({ id: p.id, name: p.name, sku: p.sku })).concat(SEED_CATALOG)
}
const catalogOptions = computed(() => getCatalog().map(c => ({ id: c.id, label: c.name + ' (' + c.sku + ')' })))
const bundleComponentRows = computed(() =>
  bundleComponents.value.map(c => ({ id: c.id, title: bundleComponentTitle(c.name), products: c.products }))
)
function openComponentModal() {
  componentModal.value = { name: '', rows: [{ id: 'r' + Date.now(), productId: '' }], editingId: null }
}
function openEditComponent(id: string) {
  const c = bundleComponents.value.find(x => x.id === id)
  if (!c) return
  componentModal.value = {
    name: c.name,
    rows: c.products.map((p, i) => ({ id: 'r' + Date.now() + i, productId: p.id })),
    editingId: id
  }
}
function closeComponentModal() {
  componentModal.value = null
}
function addModalRow() {
  if (!componentModal.value) return
  componentModal.value.rows = [...componentModal.value.rows, { id: 'r' + Date.now(), productId: '' }]
}
function removeModalRow(id: string) {
  if (!componentModal.value) return
  componentModal.value.rows = componentModal.value.rows.filter(r => r.id !== id)
}
function updateModalRow(id: string, productId: string) {
  if (!componentModal.value) return
  componentModal.value.rows = componentModal.value.rows.map(r => r.id === id ? { ...r, productId } : r)
}
const componentSaveDisabled = computed(() =>
  !(componentModal.value && componentModal.value.name.trim() && componentModal.value.rows.some(r => r.productId))
)
function saveComponent() {
  const m = componentModal.value
  if (!m) return
  const catalog = getCatalog()
  const products = m.rows.filter(r => r.productId).map((r) => {
    const p = catalog.find(c => c.id === r.productId)
    return { id: r.productId, name: p?.name || '', sku: p?.sku || '' }
  })
  if (!m.name.trim() || products.length === 0) return
  const comp: BundleComponentModel = { id: m.editingId || ('bc' + Date.now()), name: m.name.trim(), products }
  bundleComponents.value = m.editingId
    ? bundleComponents.value.map(c => c.id === m.editingId ? comp : c)
    : [...bundleComponents.value, comp]
  componentModal.value = null
}
function removeComponent(id: string) {
  bundleComponents.value = bundleComponents.value.filter(c => c.id !== id)
}

// ── pricing (Initial Fee breakdown; scope is always Default on this screen) ──
const initialTotal = computed(() =>
  form.initialComponents.reduce((t, c) => {
    if (!c.published || !c.feeId) return t
    return t + (parseFloat(c.amount) || 0)
  }, 0)
)
const initialTotalLabel = computed(() => '¥' + Math.round(initialTotal.value).toLocaleString('en-US'))
const initialComponentRows = computed(() => {
  const chosen = form.initialComponents.map(c => c.feeId).filter(Boolean)
  const mapped = form.initialComponents.map((c, i) => {
    const fee = feeById(fees.value, c.feeId)
    const isBase = c.feeId === FEE_BASE_ID
    const options = fees.value.filter(f => f.id === c.feeId || chosen.indexOf(f.id) === -1)
    return {
      index: i,
      feeId: c.feeId,
      name: fee ? fee.name : 'Select component...',
      isBase,
      showAddBefore: false,
      selectable: !isBase,
      options: options.map(o => ({ id: o.id, name: o.name })),
      amount: c.amount,
      published: c.published,
      publishLocked: isBase,
      publishTitle: isBase ? 'Base Price is always published' : (c.published ? 'Published' : 'Unpublished'),
      canRemove: !isBase,
      rowStyle: `display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #f1f5f9;${c.published ? '' : 'background:#fafafa;opacity:0.7;'}`
    }
  })
  // the locked Base Price row sinks to the bottom of the table, with the
  // "Add component" row rendered just above it. `index` stays the index into
  // `form.initialComponents`, so the handlers are unaffected by the reorder.
  const nonBase = mapped.filter(r => !r.isBase)
  const baseRows = mapped.filter(r => r.isBase)
  if (baseRows[0]) baseRows[0].showAddBefore = true
  return nonBase.concat(baseRows)
})
function setComponentFeeId(i: number, feeId: string) {
  form.initialComponents = form.initialComponents.map((c, idx) => idx === i ? { ...c, feeId } : c)
  saveError.value = null
}
function setComponentAmount(i: number, amount: string) {
  form.initialComponents = form.initialComponents.map((c, idx) => idx === i ? { ...c, amount } : c)
  saveError.value = null
}
function toggleComponentPublish(i: number) {
  const c = form.initialComponents[i]
  if (!c || c.feeId === FEE_BASE_ID) return
  form.initialComponents = form.initialComponents.map((x, idx) => idx === i ? { ...x, published: !x.published } : x)
}
function addInitialComponent() {
  form.initialComponents = [...form.initialComponents, { feeId: '', published: true, amount: '' }]
}
function removeInitialComponent(i: number) {
  const c = form.initialComponents[i]
  if (!c || c.feeId === FEE_BASE_ID) return
  form.initialComponents = form.initialComponents.filter((_, idx) => idx !== i)
}
function toggleSubscription() {
  isSubscription.value = !isSubscription.value
}
function onPricingFocus() {
  if (pricingEditing.value) return
  pricingSnapshot.value = form.priceMonthly
  pricingEditing.value = true
}
function onPricingSave() {
  pricingEditing.value = false
}
function onPricingCancel() {
  form.priceMonthly = pricingSnapshot.value
  pricingEditing.value = false
}
const subscriptionHelper = computed(() =>
  isSubscription.value ? 'Recurring — customers pay a monthly fee.' : 'One-time purchase — no monthly fee.'
)
// Variant products price per row, so the product-level price block is hidden.
const showProductPrice = computed(() => productType.value !== 'variant')
const pricePerVariant = computed(() => productType.value === 'variant')

// ── status ──
function togglePublished() {
  published.value = !published.value
}
const statusHelper = computed(() => published.value ? 'Active — available for use' : 'Inactive — hidden from use')
function toggleNotForSale() {
  notForSale.value = !notForSale.value
}
const notForSaleHelper = computed(() =>
  notForSale.value ? 'Marked as gift' : 'Regular product'
)

// ── save / cancel ──
function validate(): string[] {
  const f = form
  const missing: string[] = []
  if (!f.name || !f.name.trim()) missing.push('Product name is required')
  if (!f.sku || !f.sku.trim()) missing.push('Enter a SKU')
  if (!f.category && !f.categoryId) missing.push('Category')
  if (productType.value === 'variant') {
    const attrs = attributes.value.filter(a => a.name && a.name.trim() && a.values.length)
    if (!attrs.length) missing.push('Add at least one attribute value and click Apply')
    else if (!variants.value.length) missing.push('Click Apply to generate combinations')
    else if (variants.value.some(v => !v.sku || !String(v.sku).trim())) missing.push('Each variant needs a SKU')
  }
  const skuVal = (f.sku || '').trim()
  if (skuVal) {
    let existing: { sku?: string }[] = []
    try {
      existing = JSON.parse(localStorage.getItem('vertex_products') || '[]')
    } catch {
      // ignore malformed storage
    }
    if (existing.some(p => (p.sku || '').trim().toLowerCase() === skuVal.toLowerCase())) missing.push('SKU already exists')
  }
  return missing
}
const showSaveError = computed(() => (saveError.value || []).length > 0)
const missingFieldsLabel = computed(() => (saveError.value || []).join(', '))
const saveConfirmName = computed(() => form.name.trim() || 'this product')
const saveDisabled = computed(() => validate().length > 0)

function onSaveProduct() {
  const missing = validate()
  if (missing.length) {
    saveError.value = missing
    return
  }
  saveError.value = null
  saveConfirmOpen.value = true
}
function commitSave() {
  const f = form
  const variantsOn = productType.value === 'variant'
  const vList = variantsOn
    ? variants.value.map(v => ({ name: v.name, sku: v.sku, price: v.price, stock: v.stock, active: v.active }))
    : []
  const rec: StoredProduct = {
    id: 'u' + Date.now(),
    name: f.name.trim() || 'Untitled Product',
    sku: f.sku.trim() || '—',
    notes: f.notes,
    description: f.description,
    category: f.category,
    categoryId: f.categoryId || '',
    categoryPath: f.categoryId ? categoryPathById(categories.value, f.categoryId) : f.category,
    platformIds: f.platformIds || [],
    platformNames: (f.platformIds || [])
      .map(id => platformById(platforms.value, id)?.name)
      .filter((n): n is string => !!n),
    overrides: {},
    status: published.value ? 'Active' : 'Inactive',
    notForSale: notForSale.value,
    isDraft: false,
    productType: productType.value,
    hasVariants: variantsOn,
    variantCount: variantsOn ? vList.length : 0,
    image: f.image || undefined,
    imageName: f.imageName,
    bundle: productType.value === 'bundle'
      ? { components: bundleComponents.value.map(c => ({ id: c.id, name: c.name, products: c.products.map(p => ({ id: p.id, name: p.name, sku: p.sku })) })) }
      : null,
    attributes: variantsOn ? attributes.value.filter(a => a.name && a.values.length).map(a => ({ name: a.name, values: a.values })) : [],
    variants: vList,
    pricing: (f.priceMonthly !== '' || initialTotal.value > 0)
      ? [{ version: 'v1', monthly: f.priceMonthly, initial: initialTotal.value, components: f.initialComponents.filter(c => c.feeId).map(c => ({ feeId: c.feeId, published: !!c.published, amount: c.amount })), active: true }]
      : [],
    createdAt: Date.now()
  }
  try {
    const list = JSON.parse(localStorage.getItem('vertex_products') || '[]')
    list.unshift(rec)
    localStorage.setItem('vertex_products', JSON.stringify(list))
  } catch {
    // ignore storage failure
  }
  try {
    sessionStorage.setItem('vertex_toast', 'Product created')
  } catch {
    // ignore
  }
  savedToast.value = true
  formDirty.value = false
  saveConfirmOpen.value = false
  toastTimer = window.setTimeout(() => router.push('/dashboard'), 1200)
}

function onCancelClick() {
  if (formDirty.value) {
    cancelConfirmOpen.value = true
  } else {
    router.push('/dashboard')
  }
}
function onConfirmDiscard() {
  router.push('/dashboard')
}
</script>

<template>
  <div class="form-compact max-w-[1400px] px-10 pt-8 pb-20">
    <VertexToast
      :message="savedToast ? 'Product created successfully' : null"
      variant="dark"
    />

    <!-- header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <VertexBreadcrumb
          dense
          :items="[
            { label: 'Inventory', to: '/dashboard' },
            { label: 'Product', to: '/dashboard' },
            { label: 'Create New Product' }
          ]"
        />
        <h1 class="text-2xl font-bold text-slate-900 m-0">
          Create New Product
        </h1>
      </div>
      <div class="flex gap-2.5">
        <UButton
          variant="ghost"

          :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center hover:bg-slate-50 transition-colors' }"
          @click="onCancelClick"
        >
          Cancel
        </UButton>
        <UButton
          variant="ghost"

          :disabled="saveDisabled"

          :ui="{ base: ['border-none text-sm font-semibold px-5 py-[9px] rounded-lg transition-colors', saveDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white cursor-pointer shadow-sm hover:bg-green-600'] }"
          @click="onSaveProduct"
        >
          Save Product
        </UButton>
      </div>
    </div>

    <div class="flex flex-col gap-6">
      <!-- save error -->
      <div
        v-if="showSaveError"
        class="flex items-start gap-3 bg-red-50 border border-red-200 rounded-[10px] px-4 py-3.5"
      >
        <UIcon name="i-lucide-circle-alert" class="w-[18px] h-[18px] text-red-600 flex-shrink-0 mt-px" />
        <div>
          <div class="text-sm font-semibold text-red-700">
            Please complete all required fields before saving
          </div>
          <div class="text-[13px] text-red-600 mt-0.5">
            Missing: {{ missingFieldsLabel }}
          </div>
        </div>
      </div>

      <!-- ROW 1: Core identification + Settings -->
      <div class="flex flex-wrap gap-6 items-stretch">
        <!-- Core identification -->
        <UCard class="h-full min-w-0 grow-[999] shrink basis-[420px] p-6">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
            Core Identification
          </h2>
          <p class="text-[13px] text-slate-500 mt-0 mb-5">
            Basic details that identify this product.
          </p>

          <div class="grid gap-4 mb-4 grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))]">
            <div>
              <label class="field-label">Product Name</label>
              <input
                v-model="form.name"
                class="field-input"
                type="text"
                placeholder="e.g. Premium Cotton T-Shirt"
              >
            </div>
            <div>
              <label class="field-label">SKU</label>
              <input
                v-model="form.sku"
                class="field-input"
                type="text"
                placeholder="e.g. TSH-001"
              >
            </div>
            <div>
              <label class="field-label">Product Type</label>
              <div class="relative">
                <button type="button" :style="ddTrigger(openDropdown === 'type')" @click="toggleDropdown('type')">
                  <span class="whitespace-nowrap overflow-hidden text-ellipsis">{{ productTypeLabel }}</span>
                  <span :style="ddChevron(openDropdown === 'type')"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
                </button>
                <template v-if="openDropdown === 'type'">
                  <div class="fixed inset-0 z-40" @click="closeDropdown" />
                  <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1">
                    <button
                      v-for="opt in productTypeItems"
                      :key="opt.value"
                      type="button"
                      :style="ddOption(opt.selected)"
                      @click="setType(opt.value)"
                    >
                      <span>{{ opt.name }}</span>
                      <UIcon v-if="opt.selected" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4 max-[560px]:grid-cols-1">
            <div>
              <label class="field-label">Notes</label>
              <textarea
                v-model="form.notes"
                class="field-input resize-y"
                rows="3"
                placeholder="Internal notes about this product..."
              />
            </div>
            <div>
              <label class="field-label">Product Description</label>
              <textarea
                v-model="form.description"
                class="field-input resize-y"
                rows="3"
                placeholder="Customer-facing product description..."
              />
            </div>
          </div>

          <div>
            <label class="field-label">Product Image</label>
            <div
              v-if="form.image"
              class="flex items-center gap-3 border border-slate-200 rounded-[10px] px-3 py-2.5"
            >
              <img :src="form.image" class="w-14 h-14 rounded-lg object-cover flex-shrink-0">
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-semibold text-slate-900 overflow-hidden text-ellipsis whitespace-nowrap">
                  {{ form.imageName }}
                </div>
                <div class="text-xs text-green-600">
                  Image attached
                </div>
              </div>
              <UButton
                variant="ghost"

                title="Remove image"

                :ui="{ base: 'border border-slate-200 bg-white text-slate-500 w-7 h-7 rounded-full cursor-pointer flex items-center justify-center flex-shrink-0' }"
                @click="onRemoveImage"
              >
                <UIcon name="i-lucide-x" class="w-[13px] h-[13px]" />
              </UButton>
            </div>
            <div
              v-else
              class="border-[1.5px] border-dashed border-slate-300 rounded-[10px] p-6 flex flex-col items-center gap-2 text-slate-400 bg-slate-50 cursor-pointer"
              @click="onBrowseImage"
              @dragover.prevent
              @drop="onDropImage"
            >
              <UIcon name="i-lucide-image-plus" class="w-[22px] h-[22px] text-slate-400" />
              <span class="text-[13px]">Drag &amp; drop or <span class="text-green-600 font-semibold">browse</span></span>
            </div>
            <input
              ref="prodImageInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onImageChange"
            >
          </div>
        </UCard>

        <!-- Settings -->
        <UCard class="h-full min-w-0 grow shrink basis-[320px] p-6">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-5">
            Settings
          </h2>

          <!-- category -->
          <div class="mb-4">
            <label class="field-label">Category</label>
            <div class="relative flex-1 min-w-0">
              <button type="button" :style="ddTrigger(openDropdown === 'category')" @click="toggleDropdown('category')">
                <span
                  class="whitespace-nowrap overflow-hidden text-ellipsis"
                  :class="form.categoryId || form.category ? 'text-slate-900' : 'text-slate-400'"
                >{{ categoryDisplay }}</span>
                <span :style="ddChevron(openDropdown === 'category')"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
              </button>
              <template v-if="openDropdown === 'category'">
                <div class="fixed inset-0 z-40" @click="closeDropdown" />
                <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] max-h-[280px] overflow-y-auto p-1">
                  <button
                    v-for="opt in categoryFlat"
                    :key="opt.id"
                    type="button"
                    :style="opt.style"
                    @click="pickCategory(opt.id)"
                  >
                    <span>{{ opt.name }}</span>
                    <UIcon v-if="opt.selected" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
                  </button>
                </div>
              </template>
            </div>
          </div>

          <!-- platforms -->
          <div class="mb-5">
            <label class="field-label">Platforms</label>
            <div v-if="assignedPlatformChips.length" class="flex flex-wrap gap-1.5 mb-2">
              <span
                v-for="chip in assignedPlatformChips"
                :key="chip.id"
                class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full py-1 pr-2 pl-3 text-[13px] font-semibold"
              >
                {{ chip.name }}
                <UButton
                  variant="ghost"

                  title="Remove"

                  :ui="{ base: 'border-none bg-transparent cursor-pointer text-emerald-700 flex items-center p-0.5 rounded-full' }"
                  @click="removePlatform(chip.id)"
                >
                  <UIcon name="i-lucide-x" class="w-3 h-3" />
                </UButton>
              </span>
            </div>
            <div class="relative">
              <button type="button" :style="ddTrigger(openDropdown === 'platform')" @click="toggleDropdown('platform')">
                <span class="text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ platformAddLabel }}</span>
                <span :style="ddChevron(openDropdown === 'platform')"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
              </button>
              <template v-if="openDropdown === 'platform'">
                <div class="fixed inset-0 z-40" @click="closeDropdown" />
                <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1 max-h-[220px] overflow-y-auto">
                  <button
                    v-for="opt in availablePlatforms"
                    :key="opt.id"
                    type="button"
                    :style="ddOption(false)"
                    @click="addPlatform(opt.id)"
                  >
                    <span>{{ opt.name }}</span>
                  </button>
                  <div v-if="platformAllAssigned" class="p-2.5 text-[13px] text-slate-400 text-center">
                    All platforms assigned
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- stock -->
          <div class="mb-5">
            <label class="field-label">Stock</label>
            <div class="relative">
              <button type="button" :style="ddTrigger(openDropdown === 'stock')" @click="toggleDropdown('stock')">
                <span class="inline-flex items-center gap-2">
                  <span :style="stockDot(form.stock === 'out_stock' ? '#dc2626' : '#00c16a')" />{{ stockLabel }}
                </span>
                <span :style="ddChevron(openDropdown === 'stock')"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
              </button>
              <template v-if="openDropdown === 'stock'">
                <div class="fixed inset-0 z-40" @click="closeDropdown" />
                <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1">
                  <button
                    v-for="opt in stockItems"
                    :key="opt[0]"
                    type="button"
                    :style="ddOption(form.stock === opt[0])"
                    @click="pickStock(opt[0])"
                  >
                    <span class="inline-flex items-center gap-2"><span :style="stockDot(opt[2])" />{{ opt[1] }}</span>
                    <UIcon v-if="form.stock === opt[0]" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
                  </button>
                </div>
              </template>
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
            <button :style="trackStyle(published)" @click="togglePublished">
              <span :style="knobStyle(published)" />
            </button>
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
            <button :style="trackStyle(notForSale)" @click="toggleNotForSale">
              <span :style="knobStyle(notForSale)" />
            </button>
          </div>
        </UCard>
      </div>

      <!-- ROW 2: Variant / Bundle + Pricing -->
      <div class="flex flex-wrap gap-6">
        <div class="grow shrink basis-full min-w-0 flex flex-col gap-6">
          <!-- Product Variant -->
          <UCard v-if="hasVariants" class="p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
              Product Variant
            </h2>
            <p class="text-[13px] text-slate-500 mt-0 mb-5">
              Attribute-based variations for this product.
            </p>

            <!-- step 1: attributes -->
            <div class="flex items-center gap-2 mb-3.5">
              <span class="w-[22px] h-[22px] rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
              <span class="text-sm font-bold text-slate-900">Define Attributes</span>
            </div>

            <div class="flex flex-col gap-3 mb-3">
              <div
                v-for="attr in attributeRows"
                :key="attr.id"
                class="border border-slate-200 rounded-[10px] px-4 py-3.5 bg-slate-50"
              >
                <div class="flex flex-wrap gap-3 items-start">
                  <div class="basis-[150px] grow shrink min-w-[120px] max-w-[240px]">
                    <label class="field-label text-xs">Attribute Name</label>
                    <div class="select-wrap">
                      <select
                        class="field-input"
                        :value="attr.name"
                        @change="onAttributeSelect(attr.id, ($event.target as HTMLSelectElement).value)"
                      >
                        <option value="">
                          Select attribute...
                        </option>
                        <option
                          v-for="opt in attr.typeOptions"
                          :key="opt.value"
                          :value="opt.value"
                          :disabled="opt.disabled"
                        >
                          {{ opt.label }}
                        </option>
                      </select>
                    </div>
                  </div>
                  <div class="basis-[170px] grow shrink min-w-0">
                    <label class="field-label text-xs">Values</label>

                    <div v-if="attr.noAttr" class="text-xs text-slate-400 px-1 py-2">
                      Select an attribute first
                    </div>

                    <!-- Checkbox type: many values -->
                    <div v-else-if="attr.isCheckbox" class="flex flex-wrap gap-x-4 gap-y-2 py-1">
                      <label
                        v-for="ch in attr.choices"
                        :key="ch.label"
                        class="inline-flex items-center gap-[7px] text-[13px] text-slate-700 cursor-pointer select-none"
                      >
                        <input
                          type="checkbox"
                          :checked="ch.checked"
                          class="w-[15px] h-[15px] accent-green-500 cursor-pointer"
                          @change="toggleAttributeValue(attr.id, ch.label)"
                        >
                        {{ ch.label }}
                      </label>
                      <span v-if="attr.noChoices" class="text-xs text-slate-400">No preset values — add on the Attributes page</span>
                    </div>

                    <!-- Radio type: exactly one value -->
                    <div v-else-if="attr.isRadio" class="flex flex-wrap gap-x-4 gap-y-2 py-1">
                      <label
                        v-for="ch in attr.choices"
                        :key="ch.label"
                        class="inline-flex items-center gap-[7px] text-[13px] text-slate-700 cursor-pointer select-none"
                      >
                        <input
                          type="radio"
                          :name="attr.radioName"
                          :checked="ch.checked"
                          class="w-[15px] h-[15px] accent-green-500 cursor-pointer"
                          @change="pickAttributeValue(attr.id, ch.label)"
                        >
                        {{ ch.label }}
                      </label>
                      <span v-if="attr.noChoices" class="text-xs text-slate-400">No preset values — add on the Attributes page</span>
                    </div>

                    <!-- Select type: chips + add-value dropdown -->
                    <div v-else-if="attr.isSelectValue" class="flex flex-wrap gap-1.5 items-center">
                      <span
                        v-for="chip in attr.valueChips"
                        :key="chip"
                        class="inline-flex basis-auto grow-0 shrink-0 items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full py-[3px] pr-1.5 pl-2.5 text-[13px] font-medium"
                      >
                        {{ chip }}
                        <UButton
                          variant="ghost"

                          :ui="{ base: 'border-none bg-transparent cursor-pointer text-emerald-700 flex items-center p-0.5 rounded-full' }"
                          @click="removeAttributeValue(attr.id, chip)"
                        >
                          <UIcon name="i-lucide-x" class="w-3 h-3" />
                        </UButton>
                      </span>
                      <div v-if="attr.canAddValue" class="select-wrap basis-[130px] grow shrink min-w-[120px]">
                        <select
                          class="field-input text-[13px]"
                          :value="''"
                          @change="onPickValue(attr.id, $event)"
                        >
                          <option value="">
                            + Add value
                          </option>
                          <option v-for="opt in attr.availableValues" :key="opt" :value="opt">
                            {{ opt }}
                          </option>
                        </select>
                      </div>
                      <span v-if="attr.noChoices" class="text-xs text-slate-400 p-1">No preset values — add on the Attributes page</span>
                      <span v-else-if="attr.allSelected" class="text-xs text-slate-400 p-1">All values added</span>
                    </div>
                  </div>
                  <UButton
                    variant="ghost"

                    title="Remove attribute"

                    :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-red-500 w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0 mt-5' }"
                    @click="removeAttribute(attr.id)"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                  </UButton>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2.5 flex-wrap">
              <UButton
                variant="ghost"

                :ui="{ base: 'inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer' }"
                @click="addAttribute"
              >
                <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
                Add Attribute
              </UButton>
              <UButton
                variant="ghost"

                :disabled="applyDisabled"

                :ui="{ base: ['inline-flex items-center gap-1.5 border-none text-[13px] font-bold px-[18px] py-[9px] rounded-lg transition-colors', applyDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white cursor-pointer shadow-sm hover:bg-green-600'] }"
                @click="applyVariants"
              >
                <UIcon name="i-lucide-check" class="w-3.5 h-3.5" />
                Apply
              </UButton>
            </div>

            <!-- step 2: combinations -->
            <div class="flex items-center justify-between mt-7 mb-3.5">
              <div class="flex items-center gap-2">
                <span class="w-[22px] h-[22px] rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                <span class="text-sm font-bold text-slate-900">Variant Combinations</span>
                <span class="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{{ variantCountLabel }}</span>
              </div>
            </div>

            <div v-if="variants.length" class="border border-slate-200 rounded-[10px] overflow-hidden">
              <div class="overflow-x-auto">
                <div class="min-w-[420px]">
                  <div class="grid grid-cols-[minmax(160px,1.6fr)_150px_90px_40px] gap-2 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span class="th text-xs">Variant</span>
                    <span class="th text-xs">SKU</span>
                    <span class="th text-xs text-center">Status</span>
                    <span />
                  </div>
                  <div
                    v-for="v in variants"
                    :key="v.key"
                    class="grid grid-cols-[minmax(160px,1.6fr)_150px_90px_40px] gap-2 items-center px-4 py-2 border-b border-slate-100"
                  >
                    <span class="text-sm font-semibold text-slate-900">{{ v.name }}</span>
                    <input
                      class="field-input px-2.5 py-[7px] text-[13px]"
                      type="text"
                      :value="v.sku"
                      placeholder="SKU"
                      @input="updateVariant(v.key, 'sku', ($event.target as HTMLInputElement).value)"
                    >
                    <div class="text-center">
                      <button :style="trackStyle(v.active)" @click="toggleVariantActive(v.key)">
                        <span :style="knobStyle(v.active)" />
                      </button>
                    </div>
                    <UButton
                      variant="ghost"

                      title="Delete variant"

                      :ui="{ base: 'btn-icon-hover border-none bg-transparent text-slate-400 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                      @click="removeVariant(v.key)"
                    >
                      <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                    </UButton>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-else
              class="border-[1.5px] border-dashed border-slate-200 rounded-[10px] px-6 py-9 text-center"
            >
              <div class="text-sm font-semibold text-slate-700 mb-1">
                No variants yet
              </div>
              <div class="text-[13px] text-slate-400">
                Click Apply to generate variant combinations.
              </div>
            </div>
          </UCard>

          <!-- Bundle -->
          <UCard v-if="isBundle" class="p-6">
            <div class="flex items-center justify-between mb-4">
              <div>
                <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
                  Bundle
                </h2>
                <p class="text-[13px] text-slate-500 m-0">
                  Group existing products into components.
                </p>
              </div>
              <UButton
                variant="ghost"

                :ui="{ base: 'inline-flex items-center gap-1.5 border border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer' }"
                @click="openComponentModal"
              >
                <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
                Create Component
              </UButton>
            </div>

            <div v-if="bundleComponentRows.length" class="flex flex-col gap-4">
              <div
                v-for="comp in bundleComponentRows"
                :key="comp.id"
                class="border border-slate-200 rounded-[10px] p-4 bg-slate-50"
              >
                <div class="flex items-center justify-between mb-3">
                  <span class="text-sm font-bold text-slate-900">{{ comp.title }}</span>
                  <div class="flex gap-1.5">
                    <UButton
                      variant="ghost"

                      title="Edit component"

                      :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-slate-500 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                      @click="openEditComponent(comp.id)"
                    >
                      <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
                    </UButton>
                    <UButton
                      variant="ghost"

                      title="Delete component"

                      :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-red-500 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                      @click="removeComponent(comp.id)"
                    >
                      <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" />
                    </UButton>
                  </div>
                </div>
                <div class="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
                  <div
                    v-for="prod in comp.products"
                    :key="prod.id"
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
                No data to show. Add new for see the data.
              </div>
            </div>
          </UCard>

          <!-- Pricing -->
          <UCard class="p-6">
            <div>
              <div class="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
                    Pricing
                  </h2>
                  <p class="text-[13px] text-slate-500 m-0">
                    Set the base pricing for this product.
                  </p>
                </div>
              </div>

              <div class="flex items-center justify-between gap-3 px-3.5 py-3 border border-slate-200 rounded-[10px] mb-5 bg-slate-50">
                <div>
                  <div class="text-sm font-semibold text-slate-900">
                    Subscription product
                  </div>
                  <div class="text-[13px] text-slate-500 mt-0.5">
                    {{ subscriptionHelper }}
                  </div>
                </div>
                <button :style="trackStyle(isSubscription)" @click="toggleSubscription">
                  <span :style="knobStyle(isSubscription)" />
                </button>
              </div>

              <template v-if="showProductPrice">
                <div v-if="isSubscription" class="mb-5">
                  <div class="flex items-end gap-3">
                    <div class="flex-1">
                      <label class="field-label">Monthly Fee</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                        <input
                          v-model="form.priceMonthly"
                          class="field-input pl-[26px]"
                          type="number"
                          placeholder="0.00"
                          @focus="onPricingFocus"
                        >
                      </div>
                    </div>
                    <div v-if="pricingEditing" class="flex gap-1.5 flex-shrink-0">
                      <UButton
                        variant="ghost"

                        title="Save"

                        :ui="{ base: 'border-none bg-green-500 text-white w-[38px] h-[38px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                        @click="onPricingSave"
                      >
                        <UIcon name="i-lucide-check" class="w-[17px] h-[17px]" />
                      </UButton>
                      <UButton
                        variant="ghost"

                        title="Cancel"

                        :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-slate-500 w-[38px] h-[38px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                        @click="onPricingCancel"
                      >
                        <UIcon name="i-lucide-x" class="w-[17px] h-[17px]" />
                      </UButton>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="flex items-baseline gap-2 mb-2">
                    <label class="field-label mb-0">Initial Fee</label>
                    <span class="text-xs text-slate-400">sum of published components below.</span>
                  </div>
                  <div class="border border-slate-200 rounded-[10px] overflow-hidden">
                    <div class="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 border-b border-slate-200">
                      <span class="th flex-1 min-w-0 text-xs">Component</span>
                      <span class="th w-[150px] flex-shrink-0 text-xs">Amount</span>
                      <span class="th w-24 flex-shrink-0 text-center text-xs">Published</span>
                      <span class="w-[38px] flex-shrink-0" />
                    </div>
                    <template v-for="c in initialComponentRows" :key="c.index">
                      <div v-if="c.showAddBefore" class="px-3 py-2.5 border-b border-slate-100">
                        <UButton
                          variant="ghost"

                          :ui="{ base: 'inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-3.5 py-2 rounded-lg cursor-pointer' }"
                          @click="addInitialComponent"
                        >
                          <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> Add component
                        </UButton>
                      </div>
                      <div :style="c.rowStyle">
                        <div class="flex-1 min-w-0">
                          <div
                            v-if="c.isBase"
                            class="flex items-center gap-2 text-sm font-semibold text-slate-900 py-0.5"
                          >
                            {{ c.name }}
                            <span class="text-[11px] font-semibold px-2 py-px rounded-full bg-blue-50 text-blue-600 border border-blue-200">Base</span>
                          </div>
                          <div v-else class="select-wrap">
                            <select
                              class="field-input"
                              :value="c.feeId"
                              @change="setComponentFeeId(c.index, ($event.target as HTMLSelectElement).value)"
                            >
                              <option value="">
                                Select component...
                              </option>
                              <option v-for="opt in c.options" :key="opt.id" :value="opt.id">
                                {{ opt.name }}
                              </option>
                            </select>
                          </div>
                        </div>
                        <div class="relative w-[150px] flex-shrink-0">
                          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">¥</span>
                          <input
                            class="field-input pl-[26px]"
                            type="number"
                            :value="c.amount"
                            placeholder="0"
                            @input="setComponentAmount(c.index, ($event.target as HTMLInputElement).value)"
                          >
                        </div>
                        <div class="w-24 flex-shrink-0 flex justify-center">
                          <button
                            :disabled="c.publishLocked"
                            :title="c.publishTitle"
                            :style="switchTrackCss(c.published, c.publishLocked)"
                            @click="toggleComponentPublish(c.index)"
                          >
                            <span :style="switchKnobCss(c.published)" />
                          </button>
                        </div>
                        <div class="w-[38px] flex-shrink-0">
                          <UButton
                            v-if="c.canRemove"

                            variant="ghost"
                            title="Remove component"

                            :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-red-500 w-[38px] h-[38px] rounded-lg cursor-pointer flex items-center justify-center' }"
                            @click="removeInitialComponent(c.index)"
                          >
                            <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
                          </UButton>
                          <span
                            v-else
                            class="w-[38px] h-[38px] inline-flex items-center justify-center text-slate-300"
                          >
                            <UIcon name="i-lucide-lock" class="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </div>
                    </template>
                    <div class="flex items-center justify-between px-3.5 py-3 bg-slate-50">
                      <span class="text-sm font-bold text-slate-900">Initial Fee (Total)</span>
                      <span class="text-base font-bold text-slate-900">{{ initialTotalLabel }}</span>
                    </div>
                  </div>
                </div>
              </template>
              <div
                v-if="pricePerVariant"
                class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-3 text-[13px] text-slate-500"
              >
                <UIcon name="i-lucide-info" class="w-[15px] h-[15px] text-slate-400 flex-shrink-0" />
                <span>Each variant has its own price — set it per row in the Variant Combinations table above.</span>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </div>

    <!-- cancel confirm -->
    <VertexConfirmModal
      :open="cancelConfirmOpen"
      compact
      icon=""
      title="Discard changes?"
      message="Any information you entered will be lost."
      cancel-label="Keep editing"
      confirm-label="Discard"
      width-class="w-[420px]"
      @cancel="cancelConfirmOpen = false"
      @confirm="onConfirmDiscard"
    />

    <!-- bundle component modal -->
    <div
      v-if="componentModal"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[320] p-5"
    >
      <div class="bg-white rounded-[14px] w-[520px] max-w-[94vw] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 class="text-base font-bold text-slate-900 m-0">
            Create Component
          </h3>
          <UButton
            variant="ghost"

            :ui="{ base: 'btn-icon-hover border-none bg-transparent text-slate-500 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center' }"
            @click="closeComponentModal"
          >
            <UIcon name="i-lucide-x" class="w-[18px] h-[18px]" />
          </UButton>
        </div>
        <div class="p-6">
          <div class="mb-5">
            <label class="field-label">Component Name</label>
            <input
              v-model="componentModal.name"
              class="field-input"
              type="text"
              placeholder="Input here"
            >
          </div>
          <div class="text-[13px] font-bold text-slate-900 mb-2.5">
            Add Product
          </div>
          <div class="flex flex-col gap-2.5 mb-3">
            <div v-for="row in componentModal.rows" :key="row.id" class="flex gap-2 items-center">
              <div class="select-wrap flex-1">
                <select
                  class="field-input"
                  :value="row.productId"
                  @change="updateModalRow(row.id, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="">
                    Select one
                  </option>
                  <option v-for="opt in catalogOptions" :key="opt.id" :value="opt.id">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <UButton
                v-if="componentModal.rows.length > 1"

                variant="ghost"
                title="Remove product"

                :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-red-500 w-[38px] h-[38px] rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0' }"
                @click="removeModalRow(row.id)"
              >
                <UIcon name="i-lucide-trash-2" class="w-4 h-4" />
              </UButton>
            </div>
          </div>
          <UButton
            variant="ghost"

            :ui="{ base: 'w-full inline-flex items-center justify-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-4 py-2.5 rounded-lg cursor-pointer' }"
            @click="addModalRow"
          >
            <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
            Add Product
          </UButton>
        </div>
        <div class="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100">
          <UButton
            variant="ghost"

            :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer' }"
            @click="closeComponentModal"
          >
            Cancel
          </UButton>
          <UButton
            variant="ghost"

            :disabled="componentSaveDisabled"

            :ui="{ base: ['border-none text-white text-sm font-semibold px-5 py-[9px] rounded-lg', componentSaveDisabled ? 'bg-emerald-200 cursor-not-allowed' : 'bg-green-500 cursor-pointer'] }"
            @click="saveComponent"
          >
            Save Component
          </UButton>
        </div>
      </div>
    </div>

    <!-- save confirm -->
    <VertexConfirmModal
      :open="saveConfirmOpen"
      compact
      tone="success"
      icon="circle-check"
      title="Save product?"
      :message="`You're about to save ${saveConfirmName}. You can edit its details later from the product page.`"
      cancel-label="Cancel"
      confirm-label="Save Product"
      width-class="w-[420px]"
      @cancel="saveConfirmOpen = false"
      @confirm="commitSave()"
    />
  </div>
</template>

<style scoped>
select.field-input {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 28px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 16px 16px;
  cursor: pointer;
}
</style>
