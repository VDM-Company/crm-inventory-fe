<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type {
  Category,
  DashStat,
  ProductType,
  StoredProduct
} from '~/types'

useHead({ title: 'Dashboard — Vertex' })

const router = useRouter()

// ── reactive state (mirrors the design's DCLogic component state) ──
const search = ref('')
const filtersOpen = ref(false)
const moreHoverKey = ref<string | null>(null)
const { message: toast, show: showToast } = usePageToast(3000)

const catFilter = ref('')
const platFilter = ref('')
const typeFilter = ref('')
const statusFilter = ref('')

const productsApi = useApiProducts()
const categoriesApi = useApiCategories()
const platformsApi = useApiPlatforms()
const catalogApi = useApiCatalog()

/*
 * Fetched during SSR, so the table arrives with the page instead of after it.
 *
 * The screens were ported from a design whose logic was client-side, so every
 * one of them loads in `onMounted` — which only ever runs in the browser,
 * leaving the server to render a skeleton it had everything it needed to
 * fill. This is the first converted; the rest follow if it proves out.
 *
 * The three calls stay in one `useAsyncData` rather than three: they are one
 * screen's worth of data, and splitting them would make the page paint in
 * three stages for no gain.
 *
 * The bindings reach `/api` through `useApiFetch()`, which forwards the
 * incoming cookie on the server — without that these arrive unauthenticated
 * and 401 during SSR.
 */
const { data, status, error } = await useAsyncData('dashboard', async () => {
  const [categories, platforms, products, stats] = await Promise.all([
    categoriesApi.tree().then(flattenVertexTree),
    platformsApi.list(),
    productsApi.page({ limit: 100 }).then(r => toStoredProducts(r.data)),
    catalogApi.stats()
  ])
  return { categories, platforms, products, stats }
})

const categories = computed<Category[]>(() => data.value?.categories ?? [])
const platforms = computed<VertexPlatform[]>(() => data.value?.platforms ?? [])
const storedProducts = computed<StoredProduct[]>(() => data.value?.products ?? [])
const loading = computed(() => status.value === 'pending')
const loadError = computed(() => error.value ? apiErrorMessage(error.value, 'Could not load the dashboard.') : '')

/*
 * `Date.now()` only after mount.
 *
 * It drives the "New" badge, and a server clock and a browser clock do not
 * agree — reading it during render would make the server HTML and the first
 * client render disagree, which is a hydration mismatch. Zero until mounted
 * means no row is New for one tick, which is the harmless direction.
 */
const nowTs = ref(0)

onMounted(() => {
  nowTs.value = Date.now()

  try {
    const msg = sessionStorage.getItem('vertex_toast')
    if (msg) {
      sessionStorage.removeItem('vertex_toast')
      showToast(msg)
    }
  } catch {
    // sessionStorage unavailable
  }
})

// ── summary tiles ──
// These were four hard-coded numbers from the design — 148 / 121 / 34 / 9 —
// which stayed 148 / 121 / 34 / 9 whatever the catalogue held. They come from
// `GET /admin/catalog/stats` now; the mapping is in `#shared/utils` so the
// counting decisions (trashed excluded, empty catalogue is 0%) are tested.
const statValues = computed(() => toDashStatValues(data.value?.stats))

const stats = computed<DashStat[]>(() => {
  const v = statValues.value
  return [
    { label: 'Total Products', value: String(v.total), delta: thisMonthLabel(v.createdThisMonth), deltaColor: v.createdThisMonth > 0 ? '#00a155' : '#64748b', icon: 'i-lucide-package', iconBg: '#ecfdf5', iconColor: '#00a155' },
    { label: 'Active', value: String(v.active), delta: `${v.activePercent}% of catalog`, deltaColor: '#64748b', icon: 'i-lucide-circle-check', iconBg: '#ecfdf5', iconColor: '#00a155' },
    { label: 'With Variants', value: String(v.withVariants), delta: thisMonthLabel(v.variantsCreatedThisMonth), deltaColor: v.variantsCreatedThisMonth > 0 ? '#00a155' : '#64748b', icon: 'i-lucide-layers', iconBg: '#ecfdf5', iconColor: '#00a155' },
    { label: 'Low Stock', value: String(v.lowStock), delta: v.lowStock > 0 ? 'Needs attention' : 'All in stock', deltaColor: v.lowStock > 0 ? '#dc2626' : '#64748b', icon: 'i-lucide-triangle-alert', iconBg: v.lowStock > 0 ? '#fef2f2' : '#f8fafc', iconColor: v.lowStock > 0 ? '#dc2626' : '#64748b' }
  ]
})

// ── enriched rows ──
interface VariantRow {
  name: string
  sku: string
  subLabel: string
  statusLabel: string
  active: boolean
  onView: () => void
}

interface EnrichedRow {
  key: string
  name: string
  sku: string
  status: 'Active' | 'Inactive'
  productType: ProductType
  typeLabel: string
  hasVariants: boolean
  variantCount: number
  isNew: boolean
  image?: string
  catId: string | null
  categoryId?: string
  productCategory: string
  categoryLabel: string
  platformIdList: string[]
  platformChips: string[]
  platformMore: boolean
  platformMoreLabel: string
  platformMoreTitle: string
  hasPlatforms: boolean
  variantRows: VariantRow[]
  onViewDetail: () => void
}

const allRows = computed<EnrichedRow[]>(() => {
  const cats = categories.value
  const plats = platforms.value

  return storedProducts.value.map((r) => {
    const t0 = r.productType || 'single'
    const migType: ProductType = t0 === 'variant'
      ? 'variant'
      : (t0 === 'bundle' ? 'bundle' : ((r.hasVariants || (r.variants && r.variants.length)) ? 'variant' : 'single'))
    const hasVariants = t0 === 'variant'
      ? true
      : (r.hasVariants !== undefined ? !!r.hasVariants : !!(r.variants && r.variants.length > 0))
    const vCount = r.variants?.length ? r.variants.length : (r.variantCount || 0)

    let cat: Category | null = null
    if (r.categoryId) cat = categoryById(cats, r.categoryId)
    if (!cat) cat = categoryByName(cats, r.category || '')

    const ids = r.platformIds || []
    const names = (r.platformNames && r.platformNames.length)
      ? r.platformNames.slice()
      : ids.map(id => platformById(plats, id)?.name).filter((n): n is string => !!n)

    const key = r.id || r.sku
    // Real variant records when present, otherwise placeholders so a product
    // that only carries a count still expands.
    let vs = (hasVariants && r.variants?.length) ? r.variants : []
    if (!vs.length && hasVariants && vCount > 0) {
      vs = Array.from({ length: vCount }, (_, i) => ({
        name: r.name + ' — Variant ' + (i + 1),
        sku: (r.sku || 'SKU') + '-' + String(i + 1).padStart(2, '0'),
        price: '',
        stock: '',
        active: r.status !== 'Inactive'
      }))
    }

    return {
      key,
      name: r.name,
      sku: r.sku,
      status: r.status,
      productType: migType,
      typeLabel: migType === 'bundle' ? 'Bundle' : (migType === 'variant' ? 'Variant' : 'Single'),
      hasVariants,
      variantCount: hasVariants ? vCount : 0,
      // The API decides this itself; the timestamp rule is the fallback for
      // a record that does not carry the flag.
      isNew: r.isNew ?? (!r.createdAt || (nowTs.value - r.createdAt) < 24 * 60 * 60 * 1000),
      image: r.image,
      catId: cat ? cat.id : null,
      categoryId: r.categoryId,
      productCategory: r.category || '',
      categoryLabel: r.categoryPath || (cat ? categoryPathById(cats, cat.id) : (r.category || '—')),
      platformIdList: ids,
      platformChips: names.slice(0, 2),
      platformMore: names.length > 2,
      platformMoreLabel: names.length > 2 ? ('+' + (names.length - 2)) : '',
      platformMoreTitle: names.length > 2 ? names.slice(2).join(', ') : '',
      hasPlatforms: names.length > 0,
      variantRows: vs.map(v => ({
        name: v.name,
        sku: v.sku || '—',
        subLabel: (v.price !== '' && v.price != null ? '¥' + Number(v.price).toFixed(2) : '—')
          + ' · Qty ' + (v.stock !== '' && v.stock != null ? v.stock : '0'),
        statusLabel: v.active ? 'Active' : 'Inactive',
        active: v.active,
        onView: () => {
          router.push({ path: '/products/variant-detail', query: { product: r.id || 'demo', variant: v.name } })
        }
      })),
      onViewDetail: () => { router.push({ path: '/products/detail', query: { id: r.id || '' } }) }
    }
  })
})

// ── filter dropdown options (only values actually present in the table) ──
// Reka rejects '' as a SelectItem value (it reserves '' for "cleared"), so the
// "All ..." choices travel as a sentinel and map back to '' for the filters.
const ALL = '__all'
function allOption(r: Ref<string>) {
  return computed({
    get: () => r.value || ALL,
    set: (v: string) => {
      r.value = v === ALL ? '' : v
    }
  })
}
const TYPE_FILTER_ITEMS = [
  { value: ALL, label: 'All types' },
  { value: 'single', label: 'Single' },
  { value: 'variant', label: 'Variant' },
  { value: 'bundle', label: 'Bundle' }
]
const STATUS_FILTER_ITEMS = [
  { value: ALL, label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
]
const catFilterSel = allOption(catFilter)
const platFilterSel = allOption(platFilter)
const typeFilterSel = allOption(typeFilter)
const statusFilterSel = allOption(statusFilter)

const categoryOptions = computed(() => flattenCategories(categories.value)
  .filter(o => allRows.value.some(r => (r.categoryId || r.productCategory) === o.id || r.productCategory === o.name))
  .map(o => ({ value: o.id, label: o.name })))

const platformOptions = computed(() => platforms.value
  .filter(p => allRows.value.some(r => r.platformIdList.indexOf(p.id) !== -1))
  .map(p => ({ value: p.id, label: p.name })))

const hasActiveFilters = computed(() => !!(catFilter.value || platFilter.value || typeFilter.value || statusFilter.value))
const activeFilterCount = computed(() => [catFilter.value, platFilter.value, typeFilter.value, statusFilter.value].filter(Boolean).length)

function clearFilters() {
  catFilter.value = ''
  platFilter.value = ''
  typeFilter.value = ''
  statusFilter.value = ''
  page.value = 1
}

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const catF = catFilter.value
  const platF = platFilter.value
  const typeF = typeFilter.value
  const statusF = statusFilter.value

  return allRows.value.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))) return false
    if (catF && (r.categoryId || r.productCategory) !== catF && r.productCategory !== catF) return false
    if (platF && r.platformIdList.indexOf(platF) === -1) return false
    if (typeF) {
      const t = r.productType === 'bundle' ? 'bundle' : ((r.hasVariants || r.productType === 'variant') ? 'variant' : 'single')
      if (t !== typeF) return false
    }
    if (statusF && r.status !== statusF) return false
    return true
  })
})

// ── pagination ──
const { page, totalPages, clampedPage, startIdx, slice: pageSlice } = usePagination(() => filteredRows.value.length, 15)
const pagedRows = computed(() => pageSlice(filteredRows.value))

function goPage(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}

const rangeFrom = computed(() => filteredRows.value.length === 0 ? 0 : startIdx.value + 1)
const rangeTo = computed(() => startIdx.value + pagedRows.value.length)
const rangeLabel = computed(() => `${rangeFrom.value}–${rangeTo.value} of ${filteredRows.value.length} row(s)`)

// Variant sub-rows render as real, column-aligned <tr>s via TanStack sub-rows;
// the greyed tint is applied per row depth through the table `meta`.
// Parent rows and variant sub-rows share one TanStack row type; the variant-only
// fields are optional on it and guarded by `row.depth` in the cell slots.
type DashRow = EnrichedRow & Partial<VariantRow>

const tableMeta = {
  class: {
    tr: (row: { depth: number }) => row.depth > 0 ? 'bg-neutral-50' : ''
  }
}

const columns: TableColumn<DashRow>[] = [
  { accessorKey: 'name', header: 'Product Name', meta: { class: { th: 'px-5', td: TABLE_EDGE.td } } },
  { id: 'variants', header: 'Variants' },
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'categoryLabel', header: 'Category' },
  { accessorKey: 'typeLabel', header: 'Type' },
  { id: 'platforms', header: 'Platforms' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-5 w-[150px]', td: TABLE_EDGE.td } } }
]

// ── derived UI helpers ──

function onNewProduct() {
  router.push('/products/new')
}
</script>

<template>
  <div class="px-8 pt-7 pb-20">
    <VertexErrorBanner :message="loadError" class="mb-4" />
    <!-- TOAST -->
    <VertexToast :message="toast" />

    <!-- HEADER -->
    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mb-1">
          Dashboard
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Overview of your product catalog and inventory.
        </p>
      </div>
      <UButton
        variant="ghost"

        :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:bg-green-600 transition-colors' }"
        @click="onNewProduct"
      >
        <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" />
        Create New Product
      </UButton>
    </div>

    <!-- SUMMARY STATS -->
    <div class="grid grid-cols-4 gap-4 mb-6 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
      <UCard
        v-for="stat in stats"
        :key="stat.label"
        class="px-5 py-[18px]"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-[15px] font-semibold text-slate-500">{{ stat.label }}</span>
          <div
            class="w-8 h-8 rounded-lg flex items-center justify-center"
            :style="{ background: stat.iconBg, color: stat.iconColor }"
          >
            <UIcon :name="stat.icon" class="w-4 h-4" />
          </div>
        </div>
        <div class="text-[34px] font-bold text-slate-900 leading-none">
          {{ stat.value }}
        </div>
        <div class="text-[15px] mt-2 font-semibold" :style="{ color: stat.deltaColor }">
          {{ stat.delta }}
        </div>
      </UCard>
    </div>

    <!-- RECENT PRODUCTS -->
    <UCard>
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
        <div>
          <h2 class="text-base font-bold text-slate-900 m-0">
            Recent Products
          </h2>
          <p class="text-[15px] text-slate-500 mt-0.5">
            Your most recently updated items.
          </p>
        </div>
      </div>

      <!-- search + filters -->
      <div class="px-5 py-3.5 border-b border-slate-200">
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="relative flex-1 min-w-[220px]">
            <UIcon name="i-lucide-search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              v-model="search"
              placeholder="Search by name or SKU..."
              class="w-full border border-slate-200 rounded-lg py-[9px] pr-3 pl-9 text-base text-slate-900 outline-none focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15"
              @input="page = 1"
            >
          </div>
          <div class="relative flex-shrink-0">
            <UButton
              variant="ghost"

              :ui="{ base: ['relative inline-flex items-center gap-2 bg-white text-slate-700 text-[15px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer border flex-shrink-0 transition-colors', [
                (filtersOpen || hasActiveFilters) ? 'border-green-500' : 'border-slate-200',
                filtersOpen ? 'ring-[3px] ring-green-500/15' : ''
              ]] }"
              @click="filtersOpen = !filtersOpen"
            >
              <UIcon name="i-lucide-sliders-horizontal" class="w-4 h-4" />
              Filters
              <span
                v-if="hasActiveFilters"
                class="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-green-500 text-white text-xs font-bold"
              >{{ activeFilterCount }}</span>
              <UIcon
                :name="filtersOpen ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
                class="w-[15px] h-[15px] text-slate-400"
              />
            </UButton>

            <!-- popover -->
            <template v-if="filtersOpen">
              <div class="fixed inset-0 z-40" @click="filtersOpen = false" />
              <UCard class="absolute top-[calc(100%+8px)] right-0 z-50 shadow-[0_12px_34px_rgba(0,0,0,0.16)] w-[300px] p-4">
                <div class="flex flex-col gap-3.5">
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Category</label>
                    <USelect
                      v-model="catFilterSel"
                      :items="[{ value: ALL, label: 'All categories' }, ...categoryOptions]"
                      :ui="SELECT_FILTER"
                      @update:model-value="page = 1"
                    />
                  </div>
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Platform</label>
                    <USelect
                      v-model="platFilterSel"
                      :items="[{ value: ALL, label: 'All platforms' }, ...platformOptions]"
                      :ui="SELECT_FILTER"
                      @update:model-value="page = 1"
                    />
                  </div>
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Product Type</label>
                    <USelect
                      v-model="typeFilterSel"
                      :items="TYPE_FILTER_ITEMS"
                      :ui="SELECT_FILTER"
                      @update:model-value="page = 1"
                    />
                  </div>
                  <div>
                    <label class="text-[13px] font-semibold text-slate-700 mb-1.5 block">Status</label>
                    <USelect
                      v-model="statusFilterSel"
                      :items="STATUS_FILTER_ITEMS"
                      :ui="SELECT_FILTER"
                      @update:model-value="page = 1"
                    />
                  </div>
                  <UButton
                    v-if="hasActiveFilters"

                    variant="ghost"

                    :ui="{ base: 'border border-slate-200 bg-white text-slate-500 text-sm font-semibold cursor-pointer p-2 rounded-lg inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors' }"
                    @click="clearFilters"
                  >
                    <UIcon name="i-lucide-x" class="w-3.5 h-3.5" /> Clear all
                  </UButton>
                </div>
              </UCard>
            </template>
          </div>
        </div>
      </div>

      <!-- table -->
      <VertexTableSkeleton v-if="loading" :rows="6" :columns="['26%', '14%', '18%', '16%', '12%', '8%']" />

      <div v-else class="overflow-x-auto">
        <UTable
          :data="(pagedRows as DashRow[])"
          :columns="columns"
          :get-row-id="(row: DashRow) => row.key"
          :get-sub-rows="(row: DashRow) => (row.variantRows as unknown as DashRow[])"
          :meta="tableMeta"
          :ui="{ ...tableUi('min-w-[1020px]'), th: 'th text-left text-sm px-3 py-3', td: 'px-3 py-3' }"
        >
          <template #name-cell="{ row }">
            <div v-if="row.depth === 0" class="flex items-center gap-2">
              <UButton
                v-if="row.getCanExpand()"

                variant="ghost"

                title="Toggle variants"
                :ui="{ base: 'border-none bg-transparent cursor-pointer text-slate-500 w-[22px] h-[22px] inline-flex items-center justify-center rounded-md flex-shrink-0 hover:bg-slate-100' }"
                @click="row.toggleExpanded()"
              >
                <UIcon
                  :name="row.getIsExpanded() ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                  class="w-4 h-4"
                />
              </UButton>
              <span v-else class="w-[22px] flex-shrink-0 inline-block" />
              <img
                v-if="row.original.image"
                :src="row.original.image"
                class="w-7 h-7 rounded-md object-cover flex-shrink-0"
              >
              <span class="text-base font-semibold text-slate-900">{{ row.original.name }}</span>
              <span
                v-if="row.original.isNew"
                class="inline-flex items-center text-[10px] font-bold tracking-[0.04em] uppercase px-[7px] py-0.5 rounded-full bg-green-500 text-white flex-shrink-0"
              >New</span>
            </div>
            <div v-else class="flex items-center gap-2 pl-[38px]">
              <UIcon name="i-lucide-corner-down-right" class="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
              <div>
                <div class="text-sm font-medium text-slate-700">
                  {{ row.original.name }}
                </div>
                <div class="text-xs text-slate-400">
                  {{ row.original.subLabel }}
                </div>
              </div>
            </div>
          </template>

          <template #variants-cell="{ row }">
            <template v-if="row.depth === 0">
              <span
                v-if="row.original.hasVariants"
                class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-green-600 border border-emerald-200"
              >
                <UIcon name="i-lucide-layers" class="w-[11px] h-[11px]" />{{ row.original.variantCount }} variants
              </span>
              <span v-else class="text-[15px] text-slate-300">—</span>
            </template>
          </template>

          <template #sku-cell="{ row }">
            <span :class="row.depth === 0 ? 'text-[15px] text-slate-500' : 'text-sm text-slate-500'">{{ row.original.sku }}</span>
          </template>

          <template #categoryLabel-cell="{ row }">
            <span v-if="row.depth === 0" class="text-[15px] text-slate-700">{{ row.original.categoryLabel }}</span>
            <span v-else class="text-sm text-slate-300">—</span>
          </template>

          <template #typeLabel-cell="{ row }">
            <span v-if="row.depth === 0" class="text-sm font-semibold text-slate-700">{{ row.original.typeLabel }}</span>
            <span v-else class="text-[13px] font-semibold text-slate-400">Variant</span>
          </template>

          <template #platforms-cell="{ row }">
            <template v-if="row.depth === 0">
              <div v-if="row.original.hasPlatforms" class="flex flex-wrap gap-1 max-w-[190px]">
                <span
                  v-for="pl in row.original.platformChips"
                  :key="pl"
                  class="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-[9px] py-0.5 whitespace-nowrap"
                >{{ pl }}</span>
                <span
                  v-if="row.original.platformMore"
                  class="relative inline-flex"
                  @mouseover="moreHoverKey = row.original.sku"
                  @mouseout="moreHoverKey = null"
                >
                  <span
                    class="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap cursor-default transition-colors"
                    :class="moreHoverKey === row.original.sku ? 'bg-slate-200 text-slate-700' : 'text-slate-400'"
                  >{{ row.original.platformMoreLabel }}</span>
                  <span
                    v-if="moreHoverKey === row.original.sku"
                    class="absolute bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-xs font-medium px-2.5 py-[5px] rounded-md whitespace-nowrap shadow-lg"
                  >{{ row.original.platformMoreTitle }}</span>
                </span>
              </div>
              <span v-else class="text-[15px] text-slate-300">—</span>
            </template>
            <span v-else class="text-sm text-slate-300">—</span>
          </template>

          <template #status-cell="{ row }">
            <VertexStatusBadge
              v-if="row.depth === 0"
              :active="row.original.status === 'Active'"
              :label="row.original.status"
              size="md"
            />
            <VertexStatusBadge
              v-else
              :active="row.original.active"
              :label="row.original.statusLabel"
              size="md"
            />
          </template>

          <template #action-cell="{ row }">
            <UButton
              v-if="row.depth === 0"

              variant="ghost"

              :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors' }"
              @click="row.original.onViewDetail()"
            >
              View Detail
            </UButton>
            <UButton
              v-else

              variant="ghost"

              :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold px-2.5 py-[5px] rounded-lg cursor-pointer hover:bg-slate-50 transition-colors' }"
              @click="row.original.onView?.()"
            >
              View
            </UButton>
          </template>
        </UTable>
      </div>

      <!-- pagination -->
      <VertexPagination
        v-if="filteredRows.length > 0"
        :page="clampedPage"
        :total-pages="totalPages"
        :label="rangeLabel"
        class="px-5 py-3.5 border-t border-slate-200"
        @update:page="goPage"
      />
    </UCard>
  </div>
</template>

<style scoped>
</style>
