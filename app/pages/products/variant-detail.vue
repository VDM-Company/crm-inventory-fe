<script setup lang="ts">
import type { FeeItem, ProductPricing, VertexPlatform, VertexProduct } from '~/types'

useHead({ title: 'Variant Detail — Vertex' })

const route = useRoute()

// ── shapes ──
interface VariantComponent { feeId: string, published?: boolean, amount: string | number, label?: string }
interface VariantPricing { isSubscription: boolean, monthly: string | number, components: VariantComponent[] }
interface PriceOverride { monthly?: string | number, componentAmounts?: Record<string, string> }
interface VariantRow {
  name: string
  sku?: string
  price?: string | number
  stock?: string | number
  active?: boolean
  image?: string | null
  description?: string
  notForSale?: boolean
  platformIds?: string[]
  pricing?: VariantPricing
  priceOverrides?: Record<string, PriceOverride>
}

function qParam(v: unknown): string {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
  return typeof v === 'string' ? v : ''
}
const productKey = qParam(route.query.product) || 'demo'
const variantNameQuery = qParam(route.query.variant)

// ── state ──
const mode = ref<'view' | 'edit'>('view')
const scope = ref('default')
const scopeOpen = ref(false)
const draft = ref<VariantRow | null>(null)
const { message: toast, show: showToast } = usePageToast()
const saveError = ref('')
const loading = ref(true)

const platforms = ref<VertexPlatform[]>([])
const fees = ref<FeeItem[]>([])
const imageInput = ref<HTMLInputElement | null>(null)

const productsApi = useApiProductsV2()
const platformsApi = useApiPlatformsV2()
const feesApi = useApiFeeItems()

/**
 * The three API documents this screen folds together.
 *
 * A variant is its own product here — a child with `parentId`, its own SKU,
 * status and price plan — so the screen reads the parent (for its children
 * and its platforms), the variant record, and the variant's pricing. It is
 * NOT a row inside the parent any more.
 *
 * The URL still says `?product=<parentId>&variant=<label>` because
 * `products/detail` still links that way; it becomes `?id=<variantId>` when
 * that screen moves.
 */
const parentRecord = ref<VertexProduct | null>(null)
const variantRecord = ref<VertexProduct | null>(null)
const pricingDoc = ref<ProductPricing | null>(null)
const notFoundHere = ref(false)

const baseFeeId = computed(() => fees.value.find(f => f.kind === 'base')?.id || '')

async function loadPricing(variantId: string) {
  try {
    pricingDoc.value = await productsApi.pricing(variantId)
  } catch (err) {
    // a product with no price yet, or one the API will not price
    pricingDoc.value = null
    if ((err as { statusCode?: number })?.statusCode !== 422) {
      saveError.value = apiErrorMessage(err, 'Could not load this variant’s prices.')
    }
  }
}

onMounted(async () => {
  try {
    ;[platforms.value, fees.value] = await Promise.all([platformsApi.list(), feesApi.list()])
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Could not load this variant.')
  }

  if (!productKey || productKey === 'demo') {
    loading.value = false
    return
  }

  try {
    const parent = await productsApi.get(productKey, { include: 'children' })
    parentRecord.value = parent
    const child = findVariantByLabel(parent.children, variantNameQuery)
    if (!child) {
      notFoundHere.value = true
      return
    }
    variantRecord.value = await productsApi.get(child.id)
    await loadPricing(child.id)
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Could not load this variant.')
  } finally {
    loading.value = false
  }
})

/** The row the screen renders, built from the three documents above. */
const view = computed(() =>
  variantRecord.value ? toVariantView(variantRecord.value, pricingDoc.value, scope.value, variantNameQuery) : null
)

const isViewMode = computed(() => mode.value === 'view')
const isEditMode = computed(() => mode.value === 'edit')

// ── the variant + its hydrated pricing ──
// a variant carries a full pricing object; legacy rows only have `price`, which
// seeds the Base Price component amount
/**
 * Make sure the editor has a Base Price row.
 *
 * It no longer invents Tax and Shipping rows: with the API the components
 * ARE the plan's lines, and a line that is not there is a price nobody set.
 * Only the base is seeded, because a plan must carry exactly one.
 */
function hydrate(v: VariantRow): VariantRow {
  const d: VariantRow = { ...v }
  const comps = (d.pricing?.components || []).map(c => ({ ...c }))
  if (baseFeeId.value && !comps.some(c => c.feeId === baseFeeId.value)) {
    comps.unshift({ feeId: baseFeeId.value, published: true, amount: '' })
  }
  d.pricing = {
    isSubscription: !!d.pricing?.isSubscription,
    monthly: d.pricing?.monthly ?? '',
    components: comps
  }
  d.priceOverrides = {}
  return d
}

/**
 * The variant as the old view model, built from the API record and its plan.
 *
 * `notFoundHere` is deliberate: an unknown label used to fall through to the
 * demo product, which showed one variant's data under another's name.
 */
const variant = computed<VariantRow | null>(() => {
  const vw = view.value
  if (!vw) return null
  return {
    name: vw.label,
    sku: vw.sku,
    description: vw.description,
    active: vw.active,
    stock: vw.stockStatus,
    pricing: {
      isSubscription: vw.isSubscription,
      monthly: vw.monthly,
      components: vw.components.map(c => ({
        feeId: c.feeItemId,
        published: c.isPublished,
        amount: c.amount,
        label: c.label
      }))
    },
    priceOverrides: {}
  }
})
const found = computed(() => !!variantRecord.value && !notFoundHere.value)
// the row the page renders from: the draft while editing, a hydrated copy in view
const src = computed<VariantRow | null>(() => {
  if (isEditMode.value && draft.value) return draft.value
  return variant.value ? hydrate(variant.value) : null
})

const parentName = computed(() => {
  const p = parentRecord.value
  return (p ? localized(p.name) : '') || 'Product'
})
const parentTo = computed(() => parentRecord.value
  ? { path: '/products/detail', query: { id: parentRecord.value.id } }
  : { path: '/products/detail' }
)
const headerTitle = computed(() => (parentName.value ? parentName.value.toUpperCase() + ' — ' : '') + variantNameQuery)
const skuLabel = computed(() => src.value?.sku || '—')
const active = computed(() => !!src.value?.active)
const statusLabel = computed(() => active.value ? 'Active' : 'Inactive')
const statusHelper = computed(() => active.value ? 'Available for sale' : 'Hidden from customers')
const categoryLabel = computed(() => (parentRecord.value?.categories || [])[0]?.path || '—')
// the API names the axes on the variant itself
const attrPairs = computed(() =>
  (variantRecord.value?.axisValues || []).map(a => ({ label: `${a.attributeLabel} = ${a.label}` }))
)

// ── style helpers (this screen's toggles are larger than the other pages') ──
function scopeOptionStyle(selected: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;font-size:14px;color:${selected ? '#047857' : '#334155'};font-weight:${selected ? 600 : 400};cursor:pointer;`
}
const BADGE_PUBLISHED = 'font-size:11px;font-weight:600;color:#64748b;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:1px 8px;white-space:nowrap;'
const BADGE_UNPUBLISHED = 'font-size:11px;font-weight:600;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:999px;padding:1px 8px;white-space:nowrap;'

// ── scope (Default / one of the parent's assigned platforms) ──
// a variant inherits its parent's platforms; the API has no per-variant set
const assignedPlatforms = computed(() =>
  (parentRecord.value?.platforms || [])
    .map(p => platformById(platforms.value, p.id))
    .filter((p): p is VertexPlatform => !!p)
)
const scopeChoices = computed(() =>
  [{ id: 'default', name: 'Default (All Platforms)' }]
    .concat(assignedPlatforms.value.map(p => ({ id: p.id, name: p.name })))
)
const isDefaultScope = computed(() => scope.value === 'default')
const scopeDisabled = computed(() => assignedPlatforms.value.length === 0)
const scopeLabel = computed(() => (scopeChoices.value.find(c => c.id === scope.value) || scopeChoices.value[0])?.name || 'Default (All Platforms)')
const scopeHelper = computed(() => {
  if (isViewMode.value) return 'Showing effective values for this scope. Click Edit to override them.'
  return isDefaultScope.value ? 'Editing the base values for all platforms.' : 'Editing an override for this platform.'
})
const scopeTriggerStyle = computed(() =>
  `display:inline-flex;align-items:center;gap:6px;justify-content:space-between;border:1px solid ${scopeOpen.value ? '#00c16a' : '#e2e8f0'};border-radius:8px;padding:7px 12px;height:36px;font-size:13px;font-weight:600;background:#fff;color:#0f172a;cursor:${scopeDisabled.value ? 'not-allowed' : 'pointer'};min-width:200px;${scopeDisabled.value ? 'opacity:0.6;' : ''}`
)
const scopeChevronStyle = computed(() =>
  `display:inline-flex;align-items:center;color:#64748b;transition:transform 150ms ease;transform:rotate(${scopeOpen.value ? '180deg' : '0deg'});`
)
function onToggleScope() {
  if (!scopeDisabled.value) scopeOpen.value = !scopeOpen.value
}
function pickScope(id: string) {
  scope.value = id
  scopeOpen.value = false
}

// ── draft edits ──
function update(field: keyof VariantRow, value: unknown) {
  if (!draft.value) return
  draft.value = { ...draft.value, [field]: value } as VariantRow
}
function setMonthly(value: string) {
  const d = draft.value
  if (!d || !d.pricing) return
  if (isDefaultScope.value) {
    draft.value = { ...d, pricing: { ...d.pricing, monthly: value } }
    return
  }
  const ov: Record<string, PriceOverride> = { ...(d.priceOverrides || {}) }
  ov[scope.value] = { ...(ov[scope.value] || {}), monthly: value }
  draft.value = { ...d, priceOverrides: ov }
}
function setComponentAmount(feeId: string, value: string) {
  const d = draft.value
  if (!d || !d.pricing) return
  if (isDefaultScope.value) {
    draft.value = {
      ...d,
      pricing: { ...d.pricing, components: d.pricing.components.map(c => c.feeId === feeId ? { ...c, amount: value } : c) }
    }
    return
  }
  const ov: Record<string, PriceOverride> = { ...(d.priceOverrides || {}) }
  const cur: PriceOverride = { ...(ov[scope.value] || {}) }
  const prev = cur.componentAmounts || {}
  const amts: Record<string, string> = {}
  Object.keys(prev).forEach((k) => {
    if (k !== feeId) amts[k] = prev[k]!
  })
  if (value !== '') amts[feeId] = value
  cur.componentAmounts = amts
  ov[scope.value] = cur
  draft.value = { ...d, priceOverrides: ov }
}
function togglePublish(feeId: string) {
  const d = draft.value
  if (!d || !d.pricing) return
  draft.value = {
    ...d,
    pricing: { ...d.pricing, components: d.pricing.components.map(c => c.feeId === feeId ? { ...c, published: c.published === false } : c) }
  }
}
function onToggleStatus() {
  if (isEditMode.value) update('active', !draft.value?.active)
}
const giftOn = computed(() => !!src.value?.notForSale)
const giftHelper = computed(() => giftOn.value ? 'Marked as gift' : 'Regular product')
function onToggleGift() {
  update('notForSale', !giftOn.value)
}

// ── per-variant platforms (a subset of the parent's) ──
const parentPlatformIds = computed(() => (parentRecord.value?.platforms || []).map(p => p.id))
const variantPlatformIds = computed(() => {
  const base = Array.isArray(src.value?.platformIds) ? src.value!.platformIds! : parentPlatformIds.value
  return base.filter(id => parentPlatformIds.value.indexOf(id) !== -1)
})
const platformDropdownOpen = ref(false)
const editPlatformChips = computed(() =>
  variantPlatformIds.value
    .map(id => platformById(platforms.value, id))
    .filter((p): p is VertexPlatform => !!p)
)
const platformAddItems = computed(() =>
  parentPlatformIds.value
    .filter(id => variantPlatformIds.value.indexOf(id) === -1)
    .map(id => platformById(platforms.value, id))
    .filter((p): p is VertexPlatform => !!p)
)
const platformAllAssigned = computed(() => platformAddItems.value.length === 0 && variantPlatformIds.value.length > 0)
const platformAddLabel = computed(() => editPlatformChips.value.length ? 'Add another platform' : 'Add platform')
const viewPlatformChips = computed(() =>
  (Array.isArray(src.value?.platformIds) ? src.value!.platformIds! : parentPlatformIds.value)
    .map(id => platformById(platforms.value, id)?.name)
    .filter((n): n is string => !!n)
)
function addVariantPlatform(id: string) {
  const base = variantPlatformIds.value.slice()
  if (base.indexOf(id) === -1) base.push(id)
  update('platformIds', base)
  platformDropdownOpen.value = false
}
function removeVariantPlatform(id: string) {
  update('platformIds', variantPlatformIds.value.filter(x => x !== id))
}

// ── pricing components: add / remove (Base Price is locked) ──
function addComponent() {
  const d = draft.value
  if (!d || !d.pricing) return
  const used = d.pricing.components.map(c => c.feeId)
  // Only real fee items: the old fallback invented `fee_custom_<ts>`, which
  // the API rejects. With none left the button is disabled instead.
  const next = fees.value.find(f => used.indexOf(f.id) === -1)
  if (!next) return
  const feeId = next.id
  draft.value = {
    ...d,
    pricing: { ...d.pricing, components: [...d.pricing.components, { feeId, published: true, amount: '' }] }
  }
}
function removeComponent(feeId: string) {
  const d = draft.value
  if (!d || !d.pricing || feeId === baseFeeId.value) return
  draft.value = {
    ...d,
    pricing: { ...d.pricing, components: d.pricing.components.filter(c => c.feeId !== feeId) }
  }
}
function onStockChange(val: string | number) {
  update('stock', String(val ?? ''))
}
function onDescriptionChange(val: string | number) {
  update('description', String(val ?? ''))
}

// ── image ──
function onPickImage() {
  if (imageInput.value) {
    imageInput.value.value = ''
    imageInput.value.click()
  }
}
function onImageChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = ev => update('image', String(ev.target?.result || ''))
  reader.readAsDataURL(file)
}
function onRemoveImage() {
  update('image', null)
}

// ── pricing (effective values at the selected scope) ──
const pricing = computed<VariantPricing>(() => src.value?.pricing || { isSubscription: false, monthly: '', components: [] })
const scopeOv = computed<PriceOverride>(() =>
  (!isDefaultScope.value && src.value?.priceOverrides) ? (src.value.priceOverrides[scope.value] || {}) : {}
)
const effMonthly = computed(() => {
  const ov = scopeOv.value.monthly
  return (!isDefaultScope.value && ov !== undefined && ov !== '') ? ov : pricing.value.monthly
})
function effAmount(c: VariantComponent) {
  const amts = scopeOv.value.componentAmounts || {}
  const ov = amts[c.feeId]
  return (!isDefaultScope.value && ov !== undefined && ov !== '') ? ov : c.amount
}
const subscriptionLabel = computed(() => pricing.value.isSubscription ? 'Recurring — monthly fee' : 'One-time purchase')
const monthlyLabel = computed(() => (effMonthly.value === '' || effMonthly.value == null) ? '—' : '¥' + Number(effMonthly.value).toLocaleString('en-US'))
const monthlyValue = computed(() => (effMonthly.value === '' || effMonthly.value == null) ? '' : effMonthly.value)
const pricingHelper = computed(() => isDefaultScope.value ? 'Base pricing for this variant.' : 'Per-platform pricing (amounts may override the base).')
const pricingComponents = computed(() =>
  (pricing.value.components || []).map((c) => {
    const amt = effAmount(c)
    const pub = c.published !== false
    return {
      feeId: c.feeId,
      name: localized(fees.value.find(f => f.id === c.feeId)?.name) || c.label || 'Component',
      amount: (amt === '' || amt == null) ? '' : amt,
      amountLabel: (amt === '' || amt == null) ? '¥0' : '¥' + Number(amt).toLocaleString('en-US'),
      published: pub,
      publishedLabel: pub ? 'Published' : 'Unpublished',
      publishedStyle: pub ? BADGE_PUBLISHED : BADGE_UNPUBLISHED,
      canRemove: isEditMode.value && c.feeId !== baseFeeId.value,
      rowStyle: `display:grid;grid-template-columns:1fr 150px 130px 40px;gap:8px;align-items:center;padding:11px 16px;border-bottom:1px solid #f1f5f9;${pub ? '' : 'background:#fafafa;color:#94a3b8;'}`
    }
  })
)
const initialTotalLabel = computed(() => {
  const total = (pricing.value.components || []).reduce((t, c) => {
    if (c.published === false) return t
    return t + (parseFloat(String(effAmount(c))) || 0)
  }, 0)
  return '¥' + Math.round(total).toLocaleString('en-US')
})
const stockLabel = computed(() => (src.value?.stock === '' || src.value?.stock == null) ? '—' : String(src.value.stock))
const stockValue = computed(() => (src.value?.stock === '' || src.value?.stock == null) ? '' : src.value.stock)
const descriptionDisplay = computed(() => src.value?.description ? src.value.description : '—')
const descriptionValue = computed(() => src.value?.description || '')

// ── mode transitions ──
function onEditClick() {
  if (!variant.value) return
  draft.value = hydrate(variant.value)
  scope.value = 'default'
  mode.value = 'edit'
}
function onCancelEdit() {
  draft.value = variant.value ? hydrate(variant.value) : null
  scope.value = 'default'
  scopeOpen.value = false
  mode.value = 'view'
}
/**
 * Saving is four requests, and their order is the API's, not a preference.
 *
 *   1. PATCH the variant — its own record, with its own `lockVersion`.
 *   2. Override the platform's price, if this scope was following Default and
 *      a price was edited. The API copies the Default plan to start from.
 *   3. Create a price plan, but only when the prices actually changed: every
 *      POST supersedes the active plan and adds a row to the product's price
 *      history, so a rename must not reprice.
 *   4. Set the status LAST. Activating validates the product is complete, so
 *      doing it before the plan exists answers 422 `base_price_required`.
 *
 * It is not a transaction. A failure partway leaves the earlier steps
 * applied, which is why the records are re-read before the error is shown.
 */
async function onSaveEdit() {
  const d = draft.value
  const v = variantRecord.value
  if (!d || !v) return

  const lines = componentsToLines(
    (d.pricing?.components || []).map(c => ({
      feeItemId: c.feeId,
      amount: String(c.amount ?? ''),
      isPublished: c.published !== false
    })),
    baseFeeId.value,
    // the recurring price is a line of the same plan: saving without one
    // wipes it on a subscription variant (422 `monthly_required`)
    d.pricing?.isSubscription ? d.pricing?.monthly : ''
  )
  const savedLines = scopePricing(pricingDoc.value, scope.value)?.activePlan?.lines
  const pricesChanged = !pricePlanUnchanged(savedLines, lines)
  const wantActive = !!d.active

  saveError.value = ''
  try {
    const patched = await productsApi.update(
      v.id,
      { description: d.description ? { en: d.description } : null },
      v.lockVersion
    )
    variantRecord.value = patched

    if (pricesChanged) {
      if (!isDefaultScope.value && !scopeOverrides(pricingDoc.value, scope.value)) {
        await productsApi.overridePlatformPrice(v.id, scope.value)
      }
      await productsApi.createPricePlan(v.id, { scope: scope.value, effectiveAt: null, lines })
    }

    if (wantActive !== (patched.status === 'active')) {
      variantRecord.value = await productsApi.setStatus(v.id, wantActive ? 'active' : 'inactive')
    }

    await loadPricing(v.id)
  } catch (err) {
    // the steps above are not atomic, so re-read before reporting
    try {
      variantRecord.value = await productsApi.get(v.id)
      await loadPricing(v.id)
    } catch {
      // leave what is on screen; the message below is the useful part
    }
    saveError.value = apiErrorCode(err) === 'stale_version'
      ? 'Someone else changed this variant. Reload the page before saving again.'
      : apiErrorMessage(err, 'Could not save the variant.')
    return
  }

  mode.value = 'view'
  showToast('Variant updated successfully')
}
</script>

<template>
  <div class="p-5 max-w-[1280px]">
    <VertexErrorBanner :message="saveError" class="mb-4" />
    <VertexLoadingPanel v-if="loading" label="Loading variant…" />

    <template v-else>
      <!-- breadcrumb -->
      <VertexBreadcrumb
        :items="[
          { label: 'Inventory', to: '/dashboard' },
          { label: 'Product', to: '/dashboard' },
          { label: parentName, to: parentTo },
          { label: variantNameQuery }
        ]"
      />

      <!-- header -->
      <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div class="flex items-start gap-3 min-w-0">
          <NuxtLink
            :to="parentTo"
            class="hover:bg-slate-100 w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0"
          >
            <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
          </NuxtLink>
          <div class="min-w-0">
            <div class="flex items-center gap-2.5 flex-wrap">
              <h1 class="text-[22px] font-bold text-slate-900 m-0">
                {{ headerTitle }}
              </h1>
              <VertexStatusBadge v-if="found" :active="active" :label="statusLabel" />
            </div>
            <div class="text-sm text-slate-500 mt-1">
              SKU: {{ skuLabel }}
            </div>
          </div>
        </div>
        <div v-if="found" class="flex gap-2.5 flex-shrink-0">
          <UButton
            v-if="isViewMode"

            variant="ghost"

            :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 transition-colors' }"
            @click="onEditClick"
          >
            <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
          </UButton>
          <template v-else>
            <UButton
              variant="ghost"

              :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer hover:bg-slate-50 transition-colors' }"
              @click="onCancelEdit"
            >
              Cancel
            </UButton>
            <UButton
              variant="ghost"

              :ui="{ base: 'border-none bg-green-500 text-white text-sm font-bold px-5 py-[9px] rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors' }"
              @click="onSaveEdit"
            >
              Save Changes
            </UButton>
          </template>
        </div>
      </div>

      <!-- not found -->
      <UCard v-if="!found" class="text-center px-6 py-12">
        <div class="text-base font-bold text-slate-900 mb-1.5">
          Variant not found
        </div>
        <div class="text-sm text-slate-400 mb-4">
          This variant may have been removed.
        </div>
        <NuxtLink
          :to="parentTo"
          class="border-none bg-green-500 text-white text-sm font-bold px-[18px] py-[9px] rounded-lg inline-flex items-center gap-1.5 no-underline hover:bg-green-600 transition-colors"
        >
          Back to product
        </NuxtLink>
      </UCard>

      <div v-else class="flex flex-col gap-6">
        <!-- scope card -->
        <UCard class="px-5 py-4">
          <div class="flex items-center gap-3.5 flex-wrap">
            <div class="flex items-center gap-2 flex-shrink-0">
              <UIcon name="i-lucide-layers" class="w-4 h-4 text-green-600" />
              <span class="text-sm font-bold text-slate-900">Viewing for</span>
            </div>
            <div class="relative min-w-[220px]">
              <button
                type="button"
                :disabled="scopeDisabled"
                :style="scopeTriggerStyle"
                @click="onToggleScope"
              >
                <span class="whitespace-nowrap overflow-hidden text-ellipsis">{{ scopeLabel }}</span>
                <span :style="scopeChevronStyle"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
              </button>
              <template v-if="scopeOpen">
                <div class="fixed inset-0 z-40" @click="scopeOpen = false" />
                <div class="absolute top-[calc(100%+4px)] left-0 min-w-[220px] z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1">
                  <button
                    v-for="opt in scopeChoices"
                    :key="opt.id"
                    type="button"
                    :style="scopeOptionStyle(opt.id === scope)"
                    @click="pickScope(opt.id)"
                  >
                    <span>{{ opt.name }}</span>
                    <UIcon v-if="opt.id === scope" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
                  </button>
                </div>
              </template>
            </div>
            <span class="text-[12.5px] text-slate-500">{{ scopeHelper }}</span>
          </div>
        </UCard>

        <!-- Core identification + Settings -->
        <div class="flex flex-wrap gap-6 items-stretch">
          <UCard class="grow-[999] shrink basis-[360px] min-w-0 p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
              Core Identification
            </h2>
            <p class="text-[13px] text-slate-500 mt-0 mb-5">
              Identity of this product.
            </p>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span class="static-label">Product Name</span>
                <div class="static-value">
                  {{ parentName }}
                </div>
              </div>
              <div>
                <span class="static-label">SKU</span>
                <div class="static-value">
                  {{ skuLabel }}
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <span class="static-label">Product Type</span>
                <div class="static-value">
                  Single
                </div>
              </div>
              <div />
            </div>

            <div class="mb-4">
              <label class="field-label">Notes</label>
              <div v-if="isViewMode" class="static-value whitespace-pre-wrap">
                {{ descriptionDisplay }}
              </div>
              <UTextarea
                v-else
                :model-value="descriptionValue"
                :rows="3"
                placeholder="Notes specific to this variant..."
                :ui="fieldUi('resize-y')"
                @update:model-value="onDescriptionChange"
              />
            </div>

            <div>
              <label class="field-label">Product Image</label>
              <div
                v-if="src && src.image"
                class="relative w-full max-w-[280px] border border-slate-200 rounded-[10px] overflow-hidden bg-slate-50"
              >
                <img :src="src.image" class="w-full block max-h-[200px] object-contain">
                <UButton
                  v-if="isEditMode"

                  variant="ghost"
                  title="Remove image"

                  :ui="{ base: 'absolute top-2 right-2 border-none bg-slate-900/60 text-white w-[30px] h-[30px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                  @click="onRemoveImage"
                >
                  <UIcon name="i-lucide-x" class="w-[15px] h-[15px]" />
                </UButton>
              </div>
              <template v-else>
                <UButton
                  v-if="isEditMode"

                  variant="ghost"

                  :ui="{ base: 'w-full max-w-[280px] border-[1.5px] border-dashed border-slate-300 rounded-[10px] p-7 flex flex-col items-center gap-2 text-slate-400 bg-slate-50 cursor-pointer' }"
                  @click="onPickImage"
                >
                  <UIcon name="i-lucide-image-plus" class="w-[22px] h-[22px]" />
                  <span class="text-[13px]">Click to upload an image</span>
                </UButton>
                <div
                  v-else
                  class="w-full max-w-[280px] border-[1.5px] border-dashed border-slate-200 rounded-[10px] p-7 flex flex-col items-center gap-2 text-slate-300"
                >
                  <UIcon name="i-lucide-image" class="w-[22px] h-[22px]" />
                  <span class="text-[13px]">No image</span>
                </div>
              </template>
              <input
                ref="imageInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onImageChange"
              >
            </div>
          </UCard>

          <UCard class="grow shrink basis-[300px] min-w-0 self-stretch p-6">
            <h2 class="text-base font-bold text-slate-900 mt-0 mb-5">
              Settings
            </h2>

            <div class="mb-4">
              <span class="static-label">Category</span>
              <div class="static-value">
                {{ categoryLabel }}
              </div>
            </div>
            <div class="mb-4">
              <span class="static-label">Platforms</span>
              <div v-if="isViewMode" class="flex flex-wrap gap-1.5 mt-[5px]">
                <span
                  v-for="pl in viewPlatformChips"
                  :key="pl"
                  class="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-[3px]"
                >{{ pl }}</span>
                <span v-if="!variantPlatformIds.length" class="text-sm text-slate-300">—</span>
              </div>
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
                      @click="removeVariantPlatform(chip.id)"
                    >
                      <UIcon name="i-lucide-x" class="w-3 h-3" />
                    </UButton>
                  </span>
                </div>
                <div class="relative">
                  <UButton
                    variant="ghost"

                    type="button"

                    :ui="{ base: 'w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-[9px] h-10 text-sm bg-white cursor-pointer' }"
                    @click="platformDropdownOpen = !platformDropdownOpen"
                  >
                    <span class="text-slate-500">{{ platformAddLabel }}</span>
                    <span class="inline-flex items-center text-slate-500 flex-shrink-0">
                      <UIcon name="i-lucide-chevron-down" class="w-4 h-4" />
                    </span>
                  </UButton>
                  <template v-if="platformDropdownOpen">
                    <div class="fixed inset-0 z-40" @click="platformDropdownOpen = false" />
                    <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1 max-h-[220px] overflow-y-auto">
                      <UButton
                        v-for="opt in platformAddItems"

                        :key="opt.id"
                        variant="ghost"
                        type="button"

                        :ui="{ base: 'w-full text-left border-none rounded-md bg-transparent px-2.5 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50' }"
                        @click="addVariantPlatform(opt.id)"
                      >
                        <span>{{ opt.name }}</span>
                      </UButton>
                      <div v-if="platformAllAssigned" class="p-2.5 text-[13px] text-slate-400 text-center">
                        All parent platforms added
                      </div>
                    </div>
                  </template>
                </div>
                <div class="text-xs text-slate-400 mt-1.5 flex items-center gap-[5px]">
                  <UIcon name="i-lucide-info" class="w-3 h-3 flex-shrink-0" />Limited to the parent product's platforms.
                </div>
              </template>
            </div>

            <div class="mb-4">
              <label class="field-label">Stock</label>
              <div v-if="isViewMode" class="static-value">
                {{ stockLabel }}
              </div>
              <UInput
                v-else
                :model-value="String(stockValue)"
                type="number"
                placeholder="0"
                @update:model-value="onStockChange"
              />
            </div>

            <div class="flex items-center justify-between gap-3 py-3.5 border-t border-slate-100">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Status
                </div>
                <div class="text-[13px] text-slate-500 mt-0.5">
                  {{ statusHelper }}
                </div>
              </div>
              <USwitch
                :model-value="active"
                :disabled="isViewMode"
                size="xl"
                :ui="{ root: isViewMode ? 'opacity-60' : '' }"
                @update:model-value="onToggleStatus"
              />
            </div>

            <div class="flex items-center justify-between gap-3 py-3.5 border-t border-slate-100">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Mark as gift
                </div>
                <div class="text-[13px] text-slate-500 mt-0.5">
                  {{ giftHelper }}
                </div>
              </div>
              <span
                v-if="isViewMode && giftOn"
                class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5"
              >Gift</span>
              <USwitch
                v-else-if="isEditMode"
                :model-value="giftOn"
                size="sm"
                @update:model-value="onToggleGift"
              />
            </div>

            <div class="pt-3.5 border-t border-slate-100">
              <span class="static-label">Parent product</span>
              <div class="mt-[5px]">
                <NuxtLink
                  :to="parentTo"
                  class="text-[15px] font-semibold text-green-600 inline-flex items-center gap-1.5 no-underline hover:underline"
                >
                  {{ parentName }} <UIcon name="i-lucide-arrow-up-right" class="w-3.5 h-3.5" />
                </NuxtLink>
              </div>
            </div>
          </UCard>
        </div>

        <!-- attributes -->
        <UCard class="p-6">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
            Attributes
          </h2>
          <p class="text-[13px] text-slate-500 mt-0 mb-4">
            The combination that defines this variant.
          </p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="a in attrPairs"
              :key="a.label"
              class="text-[13px] font-semibold px-3 py-[5px] rounded-full bg-slate-100 text-slate-700 border border-slate-200"
            >{{ a.label }}</span>
          </div>
        </UCard>

        <!-- pricing -->
        <UCard class="p-6">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
            Pricing
          </h2>
          <p class="text-[13px] text-slate-500 mt-0 mb-5">
            {{ pricingHelper }}
          </p>

          <div class="flex flex-wrap gap-4 mb-5">
            <div class="grow shrink basis-[180px] min-w-0 border border-slate-200 rounded-[10px] px-4 py-3.5">
              <div class="th text-xs mb-1.5">
                Subscription
              </div>
              <div class="text-sm text-slate-900">
                {{ subscriptionLabel }}
              </div>
            </div>
            <div class="grow shrink basis-[140px] min-w-0 border border-slate-200 rounded-[10px] px-4 py-3.5">
              <div class="th text-xs mb-1.5">
                Monthly Fee
              </div>
              <div v-if="isViewMode" class="text-lg font-bold text-slate-900">
                {{ monthlyLabel }}
              </div>
              <div v-else class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 text-sm text-slate-400">¥</span>
                <UInput
                  :model-value="String(monthlyValue)"
                  type="number"
                  placeholder="0"
                  :ui="fieldUi('py-1.5 pl-6')"
                  @update:model-value="setMonthly(String($event))"
                />
              </div>
            </div>
            <div class="grow shrink basis-[140px] min-w-0 border border-slate-200 rounded-[10px] px-4 py-3.5">
              <div class="th text-xs mb-1.5">
                Initial Fee
              </div>
              <div class="text-lg font-bold text-slate-900">
                {{ initialTotalLabel }}
              </div>
            </div>
          </div>

          <div class="border border-slate-200 rounded-[10px] overflow-hidden">
            <div class="grid grid-cols-[1fr_150px_130px_40px] gap-2 items-center px-4 py-[11px] bg-slate-50 border-b border-slate-200">
              <span class="th text-xs">Component</span>
              <span class="th text-xs">Amount</span>
              <span class="th text-xs">Published</span>
            </div>
            <div v-for="c in pricingComponents" :key="c.feeId" :style="c.rowStyle">
              <span class="text-sm font-semibold">{{ c.name }}</span>
              <span v-if="isViewMode" class="text-sm">{{ c.amountLabel }}</span>
              <div v-else class="relative">
                <span class="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 text-[13px] text-slate-400">¥</span>
                <UInput
                  :model-value="String(c.amount)"
                  type="number"
                  placeholder="0"
                  :ui="fieldUi('px-2 py-1.5 pl-[22px] text-[13px] md:text-[13px]')"
                  @update:model-value="setComponentAmount(c.feeId, String($event))"
                />
              </div>
              <span>
                <span v-if="isViewMode" :style="c.publishedStyle">{{ c.publishedLabel }}</span>
                <USwitch
                  v-else
                  :model-value="c.published"
                  size="sm"
                  class="inline-flex"
                  @update:model-value="togglePublish(c.feeId)"
                />
              </span>
              <span class="text-center">
                <UButton
                  v-if="c.canRemove"

                  variant="ghost"
                  title="Remove component"

                  :ui="{ base: 'border-none bg-transparent text-slate-400 w-[30px] h-[30px] rounded-lg cursor-pointer inline-flex items-center justify-center hover:text-red-500' }"
                  @click="removeComponent(c.feeId)"
                >
                  <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                </UButton>
              </span>
            </div>
            <div v-if="isEditMode" class="px-4 py-2.5 border-t border-slate-100">
              <UButton
                variant="ghost"

                :ui="{ base: 'inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-3.5 py-2 rounded-lg cursor-pointer' }"
                @click="addComponent"
              >
                <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> Add component
              </UButton>
            </div>
          </div>
        </UCard>
      </div>

      <!-- toast -->
      <VertexToast :message="toast" />
    </template>
  </div>
</template>

<style scoped>
.static-label {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}
.static-value {
  font-size: 15px;
  color: #0f172a;
  margin-top: 3px;
}
</style>
