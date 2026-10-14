<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { CreateFormInput, FormProductType } from '#shared/utils/product-create'
import type {
  Attribute,
  AttributeDef,
  Category,
  FeeItem,
  ProductType,
  VariantAxis,
  VariantCombination,
  VertexProduct,
  VertexProductRow
} from '~/types'

useHead({ title: 'Create New Product — Vertex' })

const router = useRouter()

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
  priceMonthly: '',
  stock: 'in_stock',
  // Seeded from the fee items once they load, by `kind` — the ids are the
  // API's and are not known here. It used to hold three literals, one of
  // which ('fee_base') had stopped matching the real Base Price id, so the
  // row was neither recognised as the base nor resolvable to a name.
  initialComponents: [] as InitialComponent[]
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
const formDirty = ref(false)
// snapshot of the attributes last "applied" — variant combinations only
// regenerate when the user clicks Apply (design no longer auto-regenerates).
const appliedKey = ref('')

// masters — all fetched on mount. They start empty rather than seeded: a
// seeded list renders names the real API may not agree with.
const categories = ref<Category[]>([])
const platforms = ref<VertexPlatform[]>([])
const attributeDefs = ref<AttributeDef[]>([])
// The flat defs above render the value pickers; the records below keep the
// attribute and option ids, which is what a variant axis is made of.
const attributeRecords = ref<Attribute[]>([])
const fees = ref<FeeItem[]>([])
const existingSkus = ref<string[]>([])
const catalogProducts = ref<VertexProductRow[]>([])
const saveError = ref('')
const saving = ref(false)
// Set the moment the product exists. Everything after that step is a change
// to something real, so a retry must never create a second draft.
const createdId = ref('')

const baseFeeId = computed(() => fees.value.find(f => f.kind === 'base')?.id || '')

let toastTimer: number | null = null

const hasVariants = computed(() => productType.value === 'variant')
const isBundle = computed(() => productType.value === 'bundle')

const productsApi = useApiProductsV2()
const categoriesApi = useApiCategoriesV2()
const platformsApi = useApiPlatformsV2()
const attributesApi = useApiAttributesV2()
const feesApi = useApiFeeItems()

onMounted(async () => {
  try {
    ;[categories.value, platforms.value, attributeRecords.value, fees.value] = await Promise.all([
      categoriesApi.tree().then(flattenVertexTree),
      platformsApi.list(),
      attributesApi.list(),
      feesApi.list(),
      // A bundle selection has to be an active, sellable product, so the
      // picker is only offered those — anything else is 422
      // `selection_not_sellable` at save time. The duplicate-SKU rule runs
      // inside a zod refine, which cannot await, so the list it checks is
      // fetched once here. It is one page: a SKU further down the catalogue
      // is caught upstream instead, when the product leaves Draft.
      productsApi.page({ limit: 100, status: 'active', sellable: true }).then((r) => {
        catalogProducts.value = r.data
      })
    ])
    attributeDefs.value = toAttributeDefs(attributeRecords.value)
    existingSkus.value = catalogProducts.value.map(p => (p.sku || '').toLowerCase()).filter(Boolean)
    seedInitialComponents()
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Could not load the form data.')
  }
})

/**
 * The Initial Fee rows the form opens with: Base Price, Tax and Shipping, as
 * the design has them, found by `kind` rather than by a hard-coded id.
 *
 * A row left blank never becomes a price line, so seeding Shipping costs
 * nothing on a product that does not ship; typing an amount into it on one
 * that does not is 422 `shipping_not_allowed`, which is reported.
 */
function seedInitialComponents() {
  const byKind = (kind: string) => fees.value.find(f => f.kind === kind)?.id
  form.initialComponents = ['base', 'tax', 'shipping']
    .map(byKind)
    .filter((id): id is string => !!id)
    .map(feeId => ({ feeId, published: true, amount: '' }))
}

onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

// any user edit marks the form dirty (guards the Cancel confirm) and clears a
// stale "missing fields" banner (the design clears it inside every setter)
watch(
  [() => form, productType, isSubscription, published, notForSale, attributes, variants, bundleComponents],
  () => {
    formDirty.value = true
  },
  { deep: true }
)

// ── shared inline-style helpers (ported from the design) ──

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

// ── settings: category / platforms / stock / status ──
const categoryDisplay = computed(() =>
  form.categoryId ? categoryPathById(categories.value, form.categoryId) : (form.category || 'Select category')
)
const categoryFlat = computed(() =>
  flattenCategories(categories.value).map((o) => {
    const selected = o.id === form.categoryId
    // parent rows read bolder than leaves, but every row stays selectable
    const style = `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;padding-left:${o.depth ? (10 + o.depth * 16) : 10}px;font-size:14px;color:${selected ? '#047857' : '#0f172a'};font-weight:${selected ? 600 : (o.header ? 600 : 400)};cursor:pointer;`
    return { value: o.id, name: o.name, selected, style }
  })
)
function pickCategory(id: string) {
  const cat = categoryById(categories.value, id)
  if (!cat) return
  form.categoryId = id
  form.category = cat.name
  closeDropdown()
}

const assignedPlatformChips = computed(() =>
  form.platformIds
    .map(id => platformById(platforms.value, id))
    .filter((p): p is VertexPlatform => !!p)
    .map(p => ({ id: p.id, name: p.name }))
)
const availablePlatforms = computed(() =>
  platforms.value.filter(p => form.platformIds.indexOf(p.id) === -1)
)
const platformItems = computed(() => availablePlatforms.value.map(p => ({ value: p.id, name: p.name })))
const platformAllAssigned = computed(() => platforms.value.length > 0 && availablePlatforms.value.length === 0)
const platformAddLabel = computed(() => assignedPlatformChips.value.length ? 'Add another platform' : 'Add platform')
function addPlatform(id: string) {
  form.platformIds = [...form.platformIds, id]
  closeDropdown()
}
function removePlatform(id: string) {
  form.platformIds = form.platformIds.filter(x => x !== id)
}

const stockLabel = computed(() => form.stock === 'out_stock' ? 'Out of Stock' : 'In Stock')
function stockDot(colour: string) {
  return `width:8px;height:8px;border-radius:999px;flex-shrink:0;background:${colour};`
}
const stockMenuItems = computed(() => ([
  { value: 'in_stock', name: 'In Stock', dot: '#00c16a' },
  { value: 'out_stock', name: 'Out of Stock', dot: '#dc2626' }
]).map(o => ({ value: o.value, name: o.name, selected: form.stock === o.value, meta: { dot: o.dot } })))
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
// The "+ Add value" pickers are menus, not selects: the value is never kept.
// `null` holds Reka in controlled mode so the trigger falls back to its
// placeholder after each pick — `undefined` makes it go uncontrolled and the
// last pick sticks. The cast is only to satisfy USelect's prop type.
const NO_VALUE = null as unknown as string | undefined

function addAttributeValue(id: string, value: string) {
  if (!value) return
  attributes.value = attributes.value.map(a =>
    a.id === id && a.values.indexOf(value) === -1 ? { ...a, values: [...a.values, value] } : a
  )
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
// A configurable parent holds no price of its own — the API answers 422
// `not_sellable` — so the prices are per variant, and the one column means
// the monthly price on a subscription and the Base Price on anything else.
const variantPriceHeading = computed(() => isSubscription.value ? 'Monthly' : 'Price')

// ── bundle components ──
function bundleComponentTitle(name: string) {
  const n = (name || '').trim()
  return /component$/i.test(n) ? n : (n + ' Component')
}
// The bundle picker offers the active, sellable products fetched on mount.
// The design's demo catalogue is gone: its ids were made up, and a selection
// that is not a real product is refused at save time.
const catalogOptions = computed(() =>
  catalogProducts.value.map(p => ({ id: p.id, label: p.name + ' (' + p.sku + ')' }))
)
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
  const products = m.rows.filter(r => r.productId).map((r) => {
    const p = catalogProducts.value.find(c => c.id === r.productId)
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
    const fee = fees.value.find(f => f.id === c.feeId)
    const isBase = !!baseFeeId.value && c.feeId === baseFeeId.value
    const options = fees.value.filter(f => f.id === c.feeId || chosen.indexOf(f.id) === -1)
    return {
      index: i,
      feeId: c.feeId,
      name: fee ? localized(fee.name) : 'Select component...',
      isBase,
      showAddBefore: false,
      selectable: !isBase,
      options: options.map(o => ({ id: o.id, name: localized(o.name) })),
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
}
function setComponentAmount(i: number, amount: string) {
  form.initialComponents = form.initialComponents.map((c, idx) => idx === i ? { ...c, amount } : c)
}
function toggleComponentPublish(i: number) {
  const c = form.initialComponents[i]
  if (!c || c.feeId === baseFeeId.value) return
  form.initialComponents = form.initialComponents.map((x, idx) => idx === i ? { ...x, published: !x.published } : x)
}
function addInitialComponent() {
  form.initialComponents = [...form.initialComponents, { feeId: '', published: true, amount: '' }]
}
function removeInitialComponent(i: number) {
  const c = form.initialComponents[i]
  if (!c || c.feeId === baseFeeId.value) return
  form.initialComponents = form.initialComponents.filter((_, idx) => idx !== i)
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
const statusHelper = computed(() => published.value ? 'Active — available for use' : 'Inactive — hidden from use')
const notForSaleHelper = computed(() =>
  notForSale.value ? 'Marked as gift' : 'Regular product'
)

// ── save / cancel ──
// Validation lives in one zod schema. The flat fields surface inline through
// UFormField; the variant rules depend on state outside the schema (product
// type, the applied attribute set) so they are raised in `superRefine`.
const productSchema = computed(() => z.object({
  name: z.string().trim().min(1, 'Product name is required'),
  sku: z.string().trim().min(1, 'Enter a SKU'),
  category: z.string(),
  categoryId: z.string()
}).superRefine((val, ctx) => {
  if (!val.category && !val.categoryId) {
    ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Category is required' })
  }

  const sku = val.sku.trim().toLowerCase()
  if (sku && existingSkus.value.includes(sku)) {
    ctx.addIssue({ code: 'custom', path: ['sku'], message: 'SKU already exists' })
  }

  // Every price here is integer JPY: the API has no minor unit, and a
  // fractional amount is dropped on its way to the request rather than
  // rounded into a price nobody chose.
  const whole = (v: unknown) => {
    const t = String(v ?? '').trim()
    return t !== '' && Number.isInteger(Number(t))
  }

  if (productType.value !== 'variant') {
    // A subscription product must carry exactly one monthly line and any
    // other product none at all (422 `monthly_required` /
    // `monthly_not_allowed`). The toggle starts ON, so without this rule the
    // commonest save of all creates the draft and then fails on its price.
    if (isSubscription.value && !whole(form.priceMonthly)) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMonthly'],
        message: form.priceMonthly.trim()
          ? 'The monthly fee has to be a whole number of yen'
          : 'A subscription product needs a monthly fee'
      })
    }
    if (form.initialComponents.some(c => c.feeId && String(c.amount ?? '').trim() && !whole(c.amount))) {
      ctx.addIssue({
        code: 'custom',
        path: ['priceMonthly'],
        message: 'Every fee amount has to be a whole number of yen'
      })
    }
    return
  }

  const applied = attributes.value.filter(a => a.name && a.name.trim() && a.values.length)
  if (!applied.length) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Add at least one attribute value and click Apply' })
  } else if (!variants.value.length) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Click Apply to generate combinations' })
  } else if (variants.value.some(v => !v.sku || !String(v.sku).trim())) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Each variant needs a SKU' })
  } else if (variants.value.some(v => String(v.price ?? '').trim() && !whole(v.price))) {
    ctx.addIssue({ code: 'custom', path: ['variants'], message: 'Every variant price has to be a whole number of yen' })
  } else if (published.value && !variants.value.some(v => v.active && String(v.price ?? '').trim())) {
    // a configurable parent cannot be activated while no variant of it is
    // (422 `no_active_variant`), and a variant cannot be activated without a
    // price of its own (`base_price_required`)
    ctx.addIssue({
      code: 'custom',
      path: ['variants'],
      message: 'To publish this product, at least one variant needs a price and must be switched on'
    })
  }
}))
type ProductSchema = { name: string, sku: string, category: string, categoryId: string }

const validationResult = computed(() => productSchema.value.safeParse({
  name: form.name,
  sku: form.sku,
  category: form.category,
  categoryId: form.categoryId
}))

// the price rules have no UFormField of their own either, so they are shown
// under the Pricing card the same way the variant ones are shown by the table
const pricingIssue = computed(() => {
  const r = validationResult.value
  if (r.success) return null
  const issue = r.error.issues.find(i => i.path[0] === 'priceMonthly')
  return issue ? issue.message : null
})
const saveConfirmName = computed(() => form.name.trim() || 'this product')
// Matches the design: the button stays disabled until the product is valid.
const saveDisabled = computed(() => !validationResult.value.success)

// the variant rules have no field of their own, so render them beside the table
const variantIssue = computed(() => {
  const r = validationResult.value
  if (r.success) return null
  const issue = r.error.issues.find(i => i.path[0] === 'variants')
  return issue ? issue.message : null
})

function onSaveProduct(_event: FormSubmitEvent<ProductSchema>) {
  saveConfirmOpen.value = true
}
/**
 * Saving is a sequence, and the first step commits.
 *
 * The API spells the order out: create the product as a Draft, then its
 * price, then activate it — "this endpoint only creates product data; prices
 * are set afterwards through the price-plan endpoints". A configurable
 * parent is not sellable, so its prices go on its variants instead, and at
 * least one variant has to be active before the parent can be.
 *
 * So the failure that matters is one AFTER the create. The product exists by
 * then; retrying the whole form would create a second Draft. `createdId`
 * records that, the Save button stops offering to create, and the reader is
 * pointed at the Draft to finish it there.
 */
async function commitSave() {
  if (saving.value) return
  if (createdId.value) {
    // already created once; the rest is finished on the detail screen
    goToDraft()
    return
  }
  saving.value = true
  saveError.value = ''

  const type = productType.value as FormProductType
  let inlineVariants: { axes: VariantAxis[], combinations: VariantCombination[] } | undefined

  if (type === 'variant') {
    const { axes, unresolved } = resolveAxes(attributeRecords.value, attributes.value)
    const combos = resolveCombinations(attributeRecords.value, axes, variants.value)
    const unknown = [...unresolved, ...combos.unresolved]
    if (unknown.length) {
      // the matrix is built from labels; one the attribute list has no id for
      // would quietly create a different set of variants than the table shows
      saving.value = false
      saveConfirmOpen.value = false
      saveError.value = 'These variant values are not in the attribute list: ' + unknown.join(', ')
        + '. Re-pick them, or add them under Settings → Attributes.'
      return
    }
    inlineVariants = { axes, combinations: combos.combinations }
  }

  const input: CreateFormInput = {
    name: form.name,
    sku: form.sku,
    notes: form.notes,
    description: form.description,
    categoryId: form.categoryId,
    platformIds: form.platformIds || [],
    productType: type,
    stock: form.stock,
    isSubscription: isSubscription.value,
    notForSale: notForSale.value
  }

  let created: VertexProduct
  try {
    created = await productsApi.create(toProductDraft(input, inlineVariants))
  } catch (err) {
    // nothing was created, so the form is still safe to submit again
    saving.value = false
    saveConfirmOpen.value = false
    saveError.value = apiErrorMessage(err, 'Could not save the product.')
    return
  }

  createdId.value = created.id

  try {
    await priceAndPublish(created, type)
  } catch (err) {
    saving.value = false
    saveConfirmOpen.value = false
    saveError.value = apiErrorMessage(err, 'The product was saved, but the rest could not be.')
      + ' It exists as a draft — open it to finish.'
    return
  }

  saving.value = false
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

/** The product's own Initial Fee rows as price lines. */
function productLines() {
  return componentsToLines(
    form.initialComponents
      .filter(c => c.feeId)
      .map(c => ({ feeItemId: c.feeId, amount: String(c.amount ?? ''), isPublished: !!c.published })),
    baseFeeId.value,
    // the recurring price is a line of the same plan, and the API wants
    // exactly one on a subscription product and none on any other
    isSubscription.value ? form.priceMonthly : ''
  )
}

/**
 * One variant row's price.
 *
 * The table has a single Price column, which is the monthly price on a
 * subscription product and the Base Price on any other. A plan must carry
 * exactly one Base Price line either way, so the subscription case sends it
 * at zero alongside the monthly line.
 */
function variantLines(price: string) {
  return isSubscription.value
    ? componentsToLines([{ feeItemId: baseFeeId.value, amount: '0', isPublished: true }], baseFeeId.value, price)
    : componentsToLines([{ feeItemId: baseFeeId.value, amount: price, isPublished: true }], baseFeeId.value)
}

/** Steps 2 and 3, on a product that already exists. */
async function priceAndPublish(created: VertexProduct, type: FormProductType) {
  if (type === 'bundle') {
    const draft = toBundleOptionsDraft(bundleComponents.value)
    if (draft.options.length) await productsApi.saveBundleOptions(created.id, draft)
  }

  if (type !== 'variant') {
    const lines = productLines()
    if (lines.length) {
      await productsApi.createPricePlan(created.id, { scope: 'default', effectiveAt: null, lines })
    }
    if (published.value) await productsApi.setStatus(created.id, 'active')
    return
  }

  // A configurable parent carries no price of its own. Its variants were
  // created by the same call, but their ids come back only on a re-read.
  const children = (await productsApi.get(created.id, { include: 'children' })).children || []
  const toActivate: string[] = []

  for (const row of variants.value) {
    const child = findVariantByLabel(children, row.key)
    if (!child) continue
    const lines = variantLines(String(row.price ?? '').trim())
    if (!lines.length) continue
    await productsApi.createPricePlan(child.id, { scope: 'default', effectiveAt: null, lines })
    if (row.active) toActivate.push(child.id)
  }

  if (!published.value) return
  // The parent is refused while no variant is active (422 `no_active_variant`),
  // and a variant of a Draft parent activates without the price check — so
  // the variants go first, and only the ones that are switched on and priced.
  for (const id of toActivate) await productsApi.setStatus(id, 'active')
  await productsApi.setStatus(created.id, 'active')
}

function goToDraft() {
  if (!createdId.value) return
  formDirty.value = false
  router.push({ path: '/products/detail', query: { id: createdId.value } })
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
          type="submit"
          form="create-product"
          variant="ghost"
          :disabled="saveDisabled"
          :ui="{ base: ['border-none text-sm font-semibold px-5 py-[9px] rounded-lg transition-colors', saveDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white cursor-pointer shadow-sm hover:bg-green-600'] }"
        >
          Save Product
        </UButton>
      </div>
    </div>

    <UForm
      id="create-product"
      :schema="productSchema"
      :state="form"
      class="flex flex-col gap-6"
      @submit="onSaveProduct"
    >
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
            <UFormField
              name="name"
              label="Product Name"
              required
              :ui="FORM_FIELD_COMPACT"
            >
              <UInput
                v-model="form.name"
                placeholder="e.g. Premium Cotton T-Shirt"
                :ui="fieldCompact()"
              />
            </UFormField>
            <UFormField
              name="sku"
              label="SKU"
              required
              :ui="FORM_FIELD_COMPACT"
            >
              <UInput
                v-model="form.sku"
                placeholder="e.g. TSH-001"
                :ui="fieldCompact()"
              />
            </UFormField>
            <div>
              <label class="field-label">Product Type</label>
              <div class="relative">
                <VertexSelectMenu
                  :open="openDropdown === 'type'"
                  :label="productTypeLabel"
                  :items="productTypeItems"
                  @toggle="toggleDropdown('type')"
                  @close="closeDropdown"
                  @select="setType($event as ProductType)"
                />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4 mb-4 max-[560px]:grid-cols-1">
            <div>
              <label class="field-label">Notes</label>
              <UTextarea
                v-model="form.notes"
                :rows="3"
                placeholder="Internal notes about this product..."
                :ui="fieldCompact('resize-y')"
              />
            </div>
            <div>
              <label class="field-label">Product Description</label>
              <UTextarea
                v-model="form.description"
                :rows="3"
                placeholder="Customer-facing product description..."
                :ui="fieldCompact('resize-y')"
              />
            </div>
          </div>

          <div>
            <label class="field-label">Product Image</label>
            <div class="border-[1.5px] border-dashed border-slate-200 rounded-[10px] p-6 flex flex-col items-center gap-2 text-slate-400 bg-slate-50">
              <UIcon name="i-lucide-image-off" class="w-[22px] h-[22px] text-slate-300" />
              <span class="text-[13px] text-center">Images are added after the product is saved</span>
            </div>
            <p class="text-xs text-slate-400 mt-1.5">
              The API attaches an image by its upload id, which comes from a pre-signed upload
              (<code class="font-mono">POST /admin/uploads</code>) that this app does not do yet.
              The picker used to accept a file and drop it on save.
            </p>
          </div>
        </UCard>

        <!-- Settings -->
        <UCard class="h-full min-w-0 grow shrink basis-[320px] p-6">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-5">
            Settings
          </h2>

          <!-- category -->
          <UFormField
            name="categoryId"
            label="Category"
            required
            class="mb-4"
            :ui="FORM_FIELD_COMPACT"
          >
            <div class="relative flex-1 min-w-0">
              <VertexSelectMenu
                :open="openDropdown === 'category'"
                :label="categoryDisplay"
                :placeholder="!(form.categoryId || form.category)"
                :items="categoryFlat"
                max-height="280px"
                @toggle="toggleDropdown('category')"
                @close="closeDropdown"
                @select="pickCategory"
              />
            </div>
          </UFormField>

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
              <VertexSelectMenu
                :open="openDropdown === 'platform'"
                :label="platformAddLabel"
                :items="platformItems"
                max-height="220px"
                @toggle="toggleDropdown('platform')"
                @close="closeDropdown"
                @select="addPlatform"
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
          </div>

          <!-- stock -->
          <div class="mb-5">
            <label class="field-label">Stock</label>
            <div class="relative">
              <VertexSelectMenu
                :open="openDropdown === 'stock'"
                :label="stockLabel"
                :items="stockMenuItems"
                @toggle="toggleDropdown('stock')"
                @close="closeDropdown"
                @select="pickStock"
              >
                <template #label>
                  <span class="inline-flex items-center gap-2">
                    <span :style="stockDot(form.stock === 'out_stock' ? '#dc2626' : '#00c16a')" />{{ stockLabel }}
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
            <USwitch v-model="published" class="shrink-0" />
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
            <USwitch v-model="notForSale" class="shrink-0" />
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
                      <USelect
                        :model-value="attr.name || undefined"
                        :items="attr.typeOptions"
                        placeholder="Select attribute..."
                        :ui="fieldCompact()"
                        @update:model-value="onAttributeSelect(attr.id, String($event))"
                      />
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
                        <USelect
                          :model-value="NO_VALUE"
                          :items="attr.availableValues"
                          placeholder="+ Add value"
                          :ui="SELECT_ADD_VALUE"
                          @update:model-value="addAttributeValue(attr.id, String($event))"
                        />
                      </div>
                      <span v-if="attr.noChoices" class="text-xs text-slate-400 p-1">No preset values — add on the Attributes page</span>
                      <span v-else-if="attr.allSelected" class="text-xs text-slate-400 p-1">All values added</span>
                    </div>
                  </div>
                  <UButton
                    variant="ghost"

                    title="Remove attribute"

                    :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-500 w-9 h-9 rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0 mt-5' }"
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
                <div class="min-w-[560px]">
                  <div class="grid grid-cols-[minmax(160px,1.4fr)_140px_120px_90px_40px] gap-2 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <span class="th text-xs">Variant</span>
                    <span class="th text-xs">SKU</span>
                    <span class="th text-xs">{{ variantPriceHeading }}</span>
                    <span class="th text-xs text-center">Status</span>
                    <span />
                  </div>
                  <div
                    v-for="v in variants"
                    :key="v.key"
                    class="grid grid-cols-[minmax(160px,1.4fr)_140px_120px_90px_40px] gap-2 items-center px-4 py-2 border-b border-slate-100"
                  >
                    <span class="text-sm font-semibold text-slate-900">{{ v.name }}</span>
                    <UInput
                      :model-value="v.sku"
                      placeholder="SKU"
                      :ui="fieldCompactSm()"
                      @update:model-value="updateVariant(v.key, 'sku', String($event))"
                    />
                    <UInput
                      :model-value="v.price"
                      placeholder="0"
                      inputmode="numeric"
                      :ui="fieldCompactSm()"
                      @update:model-value="updateVariant(v.key, 'price', String($event))"
                    >
                      <template #leading>
                        <span class="text-slate-400 text-[13px]">¥</span>
                      </template>
                    </UInput>
                    <div class="text-center">
                      <USwitch
                        :model-value="v.active"
                        class="inline-flex"
                        @update:model-value="toggleVariantActive(v.key)"
                      />
                    </div>
                    <UButton
                      variant="ghost"

                      title="Delete variant"

                      :ui="{ base: 'hover:bg-slate-100 border-none bg-transparent text-slate-400 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center' }"
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

            <!-- Save stays disabled until the variants are valid, so surface the
                 reason here rather than leaving a dead button -->
            <div
              v-if="variantIssue"
              class="mt-3 flex items-center gap-2 text-[13px] text-red-600"
            >
              <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
              <span>{{ variantIssue }}</span>
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

                      :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-slate-500 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                      @click="openEditComponent(comp.id)"
                    >
                      <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
                    </UButton>
                    <UButton
                      variant="ghost"

                      title="Delete component"

                      :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-500 w-8 h-8 rounded-lg cursor-pointer inline-flex items-center justify-center' }"
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
                <USwitch v-model="isSubscription" class="shrink-0" />
              </div>

              <template v-if="showProductPrice">
                <div v-if="isSubscription" class="mb-5">
                  <div class="flex items-end gap-3">
                    <div class="flex-1">
                      <label class="field-label">Monthly Fee</label>
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-sm text-slate-400">¥</span>
                        <!-- `focus` is not a UInput emit, and its template binds
                             `@focus` after `v-bind="$attrs"`, so a `@focus` here is
                             dropped. `focusin` bubbles and passes straight through. -->
                        <UInput
                          v-model="form.priceMonthly"
                          type="number"
                          placeholder="0.00"
                          :ui="fieldCompact('pl-[26px]')"
                          @focusin="onPricingFocus"
                        />
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

                        :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-slate-500 w-[38px] h-[38px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
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
                            <USelect
                              :model-value="c.feeId || undefined"
                              :items="c.options"
                              value-key="id"
                              label-key="name"
                              placeholder="Select component..."
                              :ui="fieldCompact()"
                              @update:model-value="setComponentFeeId(c.index, String($event))"
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
                            @update:model-value="setComponentAmount(c.index, String($event))"
                          />
                        </div>
                        <div class="w-24 flex-shrink-0 flex justify-center">
                          <USwitch
                            :model-value="c.published"
                            :disabled="c.publishLocked"
                            :title="c.publishTitle"
                            :ui="{ root: c.publishLocked ? 'opacity-[0.65]' : '' }"
                            @update:model-value="toggleComponentPublish(c.index)"
                          />
                        </div>
                        <div class="w-[38px] flex-shrink-0">
                          <UButton
                            v-if="c.canRemove"

                            variant="ghost"
                            title="Remove component"

                            :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-500 w-[38px] h-[38px] rounded-lg cursor-pointer flex items-center justify-center' }"
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

                <!-- Save stays disabled until the prices are valid, so say why
                     here rather than leaving a dead button -->
                <div
                  v-if="pricingIssue"
                  class="mt-3 flex items-center gap-2 text-[13px] text-red-600"
                >
                  <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
                  <span>{{ pricingIssue }}</span>
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

      <div
        v-if="saveError"
        class="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-[13px] text-red-700"
      >
        <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
        <span class="flex-1">{{ saveError }}</span>
        <!-- the product already exists; submitting again would make a second
             draft, so the only way on is to open the one that was created -->
        <UButton
          v-if="createdId"
          type="button"
          variant="ghost"
          :ui="{ base: 'border border-red-200 bg-white text-red-700 text-[13px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0' }"
          @click="goToDraft"
        >
          Open the draft
        </UButton>
      </div>
    </UForm>

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

            :ui="{ base: 'hover:bg-slate-100 border-none bg-transparent text-slate-500 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center' }"
            @click="closeComponentModal"
          >
            <UIcon name="i-lucide-x" class="w-[18px] h-[18px]" />
          </UButton>
        </div>
        <div class="p-6">
          <div class="mb-5">
            <label class="field-label">Component Name</label>
            <UInput
              v-model="componentModal.name"
              placeholder="Input here"
              :ui="fieldCompact()"
            />
          </div>
          <div class="text-[13px] font-bold text-slate-900 mb-2.5">
            Add Product
          </div>
          <div class="flex flex-col gap-2.5 mb-3">
            <div v-for="row in componentModal.rows" :key="row.id" class="flex gap-2 items-center">
              <div class="select-wrap flex-1">
                <USelect
                  :model-value="row.productId || undefined"
                  :items="catalogOptions"
                  value-key="id"
                  placeholder="Select one"
                  :ui="fieldCompact()"
                  @update:model-value="updateModalRow(row.id, String($event))"
                />
              </div>
              <UButton
                v-if="componentModal.rows.length > 1"

                variant="ghost"
                title="Remove product"

                :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-500 w-[38px] h-[38px] rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0' }"
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
