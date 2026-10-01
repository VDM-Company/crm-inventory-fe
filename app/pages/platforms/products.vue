<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Category, Platform, StoredProduct } from '~/types'

interface ScopeOverride { name?: string, priceMonthly?: string | number }
type Overrides = Record<string, ScopeOverride>

useHead({ title: 'Platform Products — Vertex' })

const route = useRoute()

const platformId = computed(() => typeof route.query.id === 'string' ? route.query.id : '')

const platforms = ref<Platform[]>(PLATFORM_SEED)
const categories = ref<Category[]>([])
const storedProducts = ref<StoredProduct[]>([])
const search = ref('')

const loadError = ref('')

onMounted(async () => {
  try {
    ;[platforms.value, categories.value, storedProducts.value] = await Promise.all([
      loadPlatforms(), loadCategories(), loadProducts()
    ])
  } catch (err) {
    loadError.value = apiErrorMessage(err, 'Could not load this platform.')
  }
})

const platform = computed<Platform | null>(() => platformById(platforms.value, platformId.value))

function fmtYen(v: string | number | null | undefined) {
  return (v === '' || v == null) ? '—' : '¥' + Number(v).toFixed(2)
}

interface Row {
  id: string
  name: string
  nameOverridden: boolean
  sku: string
  categoryLabel: string
  typeLabel: string
  priceLabel: string
  priceOverridden: boolean
  status: string
  detailHref: { path: string, query?: Record<string, string> }
}

const rows = computed<Row[]>(() => {
  const pid = platformId.value
  const cats = categories.value

  const storedRows: Row[] = storedProducts.value
    .filter(r => Array.isArray(r.platformIds) && r.platformIds.includes(pid))
    .map((r) => {
      const overrides = (r.overrides || {}) as Overrides
      const o = overrides[pid] || {}
      const nameOv = Object.prototype.hasOwnProperty.call(o, 'name')
      const priceOv = Object.prototype.hasOwnProperty.call(o, 'priceMonthly')
      const pricing = r.pricing as { monthly?: string | number }[] | undefined
      const baseMonthly = pricing?.[0]?.monthly ?? ''
      const t = r.productType === 'variant' ? 'single' : (r.productType || 'single')

      let cat: Category | null = null
      if (r.categoryId) cat = categoryById(cats, r.categoryId)
      if (!cat) cat = categoryByName(cats, r.category || '')

      return {
        id: r.id || r.sku,
        name: nameOv ? (o.name as string) : r.name,
        nameOverridden: nameOv,
        sku: r.sku || '—',
        categoryLabel: r.categoryPath || (cat ? categoryPathById(cats, cat.id) : (r.category || '—')),
        typeLabel: t === 'bundle' ? 'Bundle' : 'Single',
        priceLabel: fmtYen(priceOv ? o.priceMonthly : baseMonthly),
        priceOverridden: priceOv,
        status: r.status || 'Active',
        detailHref: { path: '/products/detail', query: { id: r.id || '' } }
      }
    })

  let all = storedRows.slice()
  all.sort((a, b) => a.name.localeCompare(b.name))

  const q = search.value.trim().toLowerCase()
  if (q) all = all.filter(r => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q))

  return all
})

const hasRows = computed(() => rows.value.length > 0)
const countLabel = computed(() => rows.value.length === 1 ? '1 product' : rows.value.length + ' products')
const columns: TableColumn<Row>[] = [
  { accessorKey: 'name', header: 'Product Name', meta: { class: { th: 'px-5', td: TABLE_EDGE.td } } },
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'categoryLabel', header: 'Category' },
  { accessorKey: 'typeLabel', header: 'Type' },
  { accessorKey: 'priceLabel', header: 'Price' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-5 text-right', td: TABLE_EDGE.td } } }
]

const emptyTitle = computed(() => search.value.trim() ? 'No products found' : 'No products on this platform yet')
const emptyHint = computed(() => search.value.trim()
  ? `Nothing matches “${search.value}”.`
  : 'Assign products to this platform from the product form (Settings → Platforms).')
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <VertexErrorBanner :message="loadError" class="mb-4" />
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Platforms', to: '/platforms' },
        { label: platform?.name || 'Platform', strong: true },
        { label: 'Products' }
      ]"
    />

    <div class="flex items-start gap-3.5 mb-6">
      <NuxtLink
        to="/platforms"
        class="hover:bg-slate-100 w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 mt-0.5"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </NuxtLink>
      <div class="min-w-0">
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
            <UIcon name="i-lucide-globe" class="w-[18px] h-[18px]" />
          </div>
          <h1 class="text-2xl font-bold text-slate-900 m-0">
            Products on {{ platform?.name || 'Platform' }}
          </h1>
          <span class="font-mono text-[13px] text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-[3px]">{{ platform?.code || '—' }}</span>
          <span class="text-sm text-slate-500">{{ platform?.url }}</span>
        </div>
      </div>
    </div>

    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <div class="relative flex-1 min-w-[240px] max-w-[420px]">
        <UIcon name="i-lucide-search" class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          v-model="search"
          placeholder="Search by name or SKU..."
          class="w-full border border-slate-200 rounded-lg py-[9px] pr-3 pl-9 text-[15px] text-slate-900 bg-white outline-none"
        >
      </div>
      <span class="text-sm text-slate-500">{{ countLabel }}</span>
    </div>

    <UCard class="overflow-hidden">
      <div v-if="hasRows" class="overflow-x-auto">
        <UTable
          :data="rows"
          :columns="columns"
          :ui="{ ...tableUi('min-w-[900px]'), th: 'th text-left text-sm px-3 py-3' }"
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-base font-semibold text-slate-900">{{ row.original.name }}</span>
              <span
                v-if="row.original.nameOverridden"
                class="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-px"
              >Overridden</span>
            </div>
          </template>

          <template #sku-cell="{ row }">
            <span class="text-sm text-slate-500">{{ row.original.sku }}</span>
          </template>

          <template #categoryLabel-cell="{ row }">
            <span class="text-[15px] text-slate-700">{{ row.original.categoryLabel }}</span>
          </template>

          <template #typeLabel-cell="{ row }">
            <span class="text-[15px] text-slate-700">{{ row.original.typeLabel }}</span>
          </template>

          <template #priceLabel-cell="{ row }">
            <div class="flex items-center gap-2 text-[15px] text-slate-700">
              {{ row.original.priceLabel }}
              <span
                v-if="row.original.priceOverridden"
                class="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-px"
              >Overridden</span>
            </div>
          </template>

          <template #status-cell="{ row }">
            <VertexStatusBadge :active="row.original.status === 'Active'" :label="row.original.status" size="md" />
          </template>

          <template #action-cell="{ row }">
            <div class="text-right">
              <NuxtLink
                :to="row.original.detailHref"
                class="hover:bg-slate-100 inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3.5 py-[7px] rounded-lg no-underline"
              >
                <UIcon name="i-lucide-eye" class="w-3.5 h-3.5" /> View Detail
              </NuxtLink>
            </div>
          </template>
        </UTable>
      </div>

      <VertexEmptyState
        v-else
        icon="package-x"
        :title="emptyTitle"
        :hint="emptyHint"
        hint-width="360px"
      />
    </UCard>
  </div>
</template>
