<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

useHead({ title: 'Variants — Vertex' })

const route = useRoute()
const router = useRouter()

interface ProductDef {
  id: string
  name: string
  sku: string
  reference: string
  category: string
  attrs: string[]
  colors: string[]
  sizes: string[]
}
interface VariantRow {
  id: string
  name: string
  sku: string
  attrChips: string[]
  price: number
  stock: number
  status: string
}

const PRODUCTS: Record<string, ProductDef> = {
  p1: { id: 'p1', name: 'Premium Cotton T-Shirt', sku: 'SKU-2000', reference: 'REF-2026-100', category: 'Apparel', attrs: ['Color', 'Size'], colors: ['Red', 'Blue'], sizes: ['S', 'M', 'L'] },
  p3: { id: 'p3', name: 'Running Sneakers Pro', sku: 'SKU-2002', reference: 'REF-2026-102', category: 'Footwear', attrs: ['Color', 'Size'], colors: ['Black', 'White'], sizes: ['8', '9'] },
  p5: { id: 'p5', name: 'Denim Slim Jacket', sku: 'SKU-2004', reference: 'REF-2026-104', category: 'Apparel', attrs: ['Size'], colors: ['Indigo'], sizes: ['S', 'M', 'L'] },
  p10: { id: 'p10', name: 'Ankle Boots Suede', sku: 'SKU-2009', reference: 'REF-2026-109', category: 'Footwear', attrs: ['Color', 'Size'], colors: ['Tan', 'Brown'], sizes: ['7', '8', '9', '10'] }
}

function buildVariants(p: ProductDef): VariantRow[] {
  const rows: VariantRow[] = []
  let n = 1
  const basePrice = 24
  p.colors.forEach((c) => {
    p.sizes.forEach((sz) => {
      const chips: string[] = []
      if (p.attrs.includes('Color')) chips.push(c)
      if (p.attrs.includes('Size')) chips.push(sz)
      rows.push({
        id: p.id + '-v' + n,
        name: chips.join(' / '),
        sku: p.sku + '-' + String(n).padStart(2, '0'),
        attrChips: chips,
        price: basePrice + (n % 4) * 2,
        stock: (n * 13) % 80,
        status: n % 5 === 0 ? 'Inactive' : 'Active'
      })
      n++
    })
  })
  return rows
}

// ── state ── (product id is URL-derived → SSR-safe to read during setup)
const rawProduct = route.query.product
const initialPid = Array.isArray(rawProduct) ? rawProduct[0] : rawProduct
const productId = ref(initialPid && PRODUCTS[initialPid] ? initialPid : 'p1')
const demoMode = ref<'populated' | 'empty'>('populated')
const searchQuery = ref('')

const product = computed(() => PRODUCTS[productId.value] || PRODUCTS.p1!)
const allVariants = computed(() => demoMode.value === 'empty' ? [] : buildVariants(product.value))
const variantCountLabel = computed(() => allVariants.value.length + ' variants')

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return allVariants.value.filter(v => !q || v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
})
const { page, totalPages, clampedPage, startIdx, endIdx, isFirstPage, isLastPage, slice: pageSlice } = usePagination(() => filtered.value.length, 8)

const columns: TableColumn<VariantRow & { priceLabel: string }>[] = [
  { accessorKey: 'name', header: 'Variant', meta: { class: { th: 'px-4', td: 'px-4' } } },
  { accessorKey: 'sku', header: 'Variant SKU' },
  { accessorKey: 'attrChips', header: 'Attributes' },
  { accessorKey: 'priceLabel', header: 'Price', meta: { class: { th: 'w-[100px]' } } },
  { accessorKey: 'stock', header: 'Stock', meta: { class: { th: 'w-[90px]' } } },
  { accessorKey: 'status', header: 'Status', meta: { class: { th: 'w-[100px]' } } },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-4 w-[150px]', td: 'px-4' } } }
]

const pageRows = computed(() =>
  pageSlice(filtered.value).map(v => ({
    ...v,
    priceLabel: '$' + v.price.toFixed(2)
  }))
)

const isEmpty = computed(() => demoMode.value === 'empty')
const noResults = computed(() => !isEmpty.value && filtered.value.length === 0)
const showEmptyState = computed(() => isEmpty.value)
const showNoResultsRow = computed(() => noResults.value)
const showTable = computed(() => !isEmpty.value && !noResults.value)

const paginationLabel = computed(() =>
  `Showing ${filtered.value.length === 0 ? 0 : startIdx.value + 1}–${Math.min(endIdx.value, filtered.value.length)} of ${filtered.value.length} variant(s)`
)
const pageNumbers = computed(() => Array.from({ length: totalPages.value }, (_, i) => i + 1))

function goToPage(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
function pageBtnStyle(n: number) {
  const cur = n === clampedPage.value
  return `width:32px;height:32px;border-radius:8px;border:1px solid ${cur ? '#00c16a' : '#e2e8f0'};background:${cur ? '#00c16a' : '#fff'};color:${cur ? '#fff' : '#334155'};font-size:13px;font-weight:600;cursor:pointer;`
}
const pagerNavStyle = 'width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#64748b;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;'

function onAddVariant() {
  router.push('/products/new')
}
function onViewDetail() {
  router.push('/products/detail')
}
const DEMO_MODE_ITEMS = [
  { value: 'populated', label: 'Populated (variants listed)' },
  { value: 'empty', label: 'Empty — no variants yet' }
]
function onDemoModeChange(v: string) {
  demoMode.value = v as 'populated' | 'empty'
  page.value = 1
}
function onSearchChange(e: Event) {
  searchQuery.value = (e.target as HTMLInputElement).value
  page.value = 1
}
</script>

<template>
  <div class="flex-1 min-w-0 flex flex-col">
    <!-- demo state bar -->
    <div class="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2.5 text-xs text-amber-800">
      <UIcon name="i-lucide-flask-conical" class="w-3.5 h-3.5" />
      <span class="font-semibold">Prototype view:</span>
      <USelect
        :model-value="demoMode"
        :items="DEMO_MODE_ITEMS"
        class="w-auto"
        :ui="{ base: 'px-2 py-1 text-[12px]/[18px] md:text-[12px]/[18px] border-amber-200 rounded-md text-amber-800', trailing: 'pe-1.5', trailingIcon: 'size-3.5 text-amber-700' }"
        @update:model-value="onDemoModeChange"
      />
    </div>

    <div class="px-8 pt-7 pb-20 flex-1">
      <!-- breadcrumb + back -->
      <div class="text-[13px] text-slate-500 mb-2.5">
        <NuxtLink to="/dashboard" class="text-green-600 no-underline hover:underline">
          Product
        </NuxtLink>
        <span class="mx-1.5 text-slate-300">/</span>
        <span class="text-slate-700">{{ product.name }}</span>
        <span class="mx-1.5 text-slate-300">/</span>
        <span class="text-slate-900 font-semibold">Variants</span>
      </div>
      <NuxtLink to="/dashboard" class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 mb-5 no-underline hover:text-slate-700">
        <UIcon name="i-lucide-arrow-left" class="w-[15px] h-[15px]" /> Back to Products
      </NuxtLink>

      <!-- parent product context header -->
      <UCard class="mb-5 flex items-center justify-between gap-4 flex-wrap px-6 py-5">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0">
            <UIcon name="i-lucide-image" class="w-[26px] h-[26px]" />
          </div>
          <div>
            <div class="flex items-center gap-2 mb-1">
              <h1 class="text-xl font-bold text-slate-900 m-0">
                {{ product.name }}
              </h1>
              <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-green-600 border border-emerald-200">
                <UIcon name="i-lucide-layers" class="w-[11px] h-[11px]" />{{ variantCountLabel }}
              </span>
            </div>
            <div class="flex items-center gap-4 text-[13px] text-slate-500 flex-wrap">
              <span><span class="text-slate-400">SKU:</span> {{ product.sku }}</span>
              <span><span class="text-slate-400">Ref:</span> {{ product.reference }}</span>
              <span><span class="text-slate-400">Category:</span> {{ product.category }}</span>
            </div>
          </div>
        </div>
        <UButton
          variant="ghost"

          :ui="{ base: 'border-none bg-green-500 text-white text-[13px] font-bold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:bg-green-600 transition-colors' }"
          @click="onAddVariant"
        >
          <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> Add Variant
        </UButton>
      </UCard>

      <!-- search + filters -->
      <div class="flex gap-2.5 mb-4">
        <div class="relative flex-1 max-w-[360px]">
          <UIcon name="i-lucide-search" class="w-[15px] h-[15px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            :value="searchQuery"
            placeholder="Search variants by name or SKU..."
            class="w-full border border-slate-200 rounded-lg py-[9px] pr-3 pl-[34px] text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-[3px] focus:ring-green-500/15"
            @change="onSearchChange"
          >
        </div>
        <UButton
          variant="ghost"
          :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[13px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5' }"
        >
          <UIcon name="i-lucide-sliders-horizontal" class="w-3.5 h-3.5" /> Filters
        </UButton>
      </div>

      <!-- table card -->
      <UCard class="overflow-hidden">
        <div
          v-if="showEmptyState"
          class="px-6 py-14 flex flex-col items-center gap-2.5 text-center"
        >
          <UIcon name="i-lucide-layers" class="w-[30px] h-[30px] text-slate-300" />
          <div class="text-[15px] font-bold text-slate-900">
            No variants yet
          </div>
          <div class="text-[13px] text-slate-500 max-w-[340px]">
            This product is set up for variants, but none have been created. Add the first variant to get started.
          </div>
          <UButton
            variant="ghost"

            :ui="{ base: 'mt-1.5 border-none bg-green-500 text-white text-[13px] font-bold px-[18px] py-[9px] rounded-lg cursor-pointer inline-flex items-center gap-1.5' }"
            @click="onAddVariant"
          >
            <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> Add Variant
          </UButton>
        </div>

        <div
          v-else-if="showNoResultsRow"
          class="px-6 py-12 flex flex-col items-center gap-2 text-center"
        >
          <UIcon name="i-lucide-search-x" class="w-6 h-6 text-slate-300" />
          <div class="text-sm font-semibold text-slate-700">
            No variants found for "{{ searchQuery }}"
          </div>
          <div class="text-[13px] text-slate-400">
            Try a different search term.
          </div>
        </div>

        <template v-else-if="showTable">
          <div class="overflow-x-auto">
            <UTable
              :data="pageRows"
              :columns="columns"
              :ui="{
                ...tableUi('min-w-[860px]'),
                th: 'th text-left text-xs px-3 py-3',
                td: 'px-3 py-3'
              }"
            >
              <template #name-cell="{ row }">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300 flex-shrink-0">
                    <UIcon name="i-lucide-image" class="w-[15px] h-[15px]" />
                  </div>
                  <span class="text-sm font-semibold text-slate-900">{{ row.original.name }}</span>
                </div>
              </template>

              <template #sku-cell="{ row }">
                <span class="text-[13px] text-slate-500">{{ row.original.sku }}</span>
              </template>

              <template #attrChips-cell="{ row }">
                <div class="flex flex-wrap gap-[5px]">
                  <span
                    v-for="chip in row.original.attrChips"
                    :key="chip"
                    class="text-[11px] font-medium px-[9px] py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
                  >{{ chip }}</span>
                </div>
              </template>

              <template #priceLabel-cell="{ row }">
                <span class="text-sm text-slate-700">{{ row.original.priceLabel }}</span>
              </template>

              <template #stock-cell="{ row }">
                <span class="text-sm text-slate-700">{{ row.original.stock }}</span>
              </template>

              <template #status-cell="{ row }">
                <VertexStatusBadge :active="row.original.status === 'Active'" :label="row.original.status" />
              </template>

              <template #action-cell>
                <div class="flex gap-2">
                  <UButton
                    variant="ghost"

                    :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer' }"
                    @click="onViewDetail"
                  >
                    View Detail
                  </UButton>
                  <UButton
                    variant="ghost"

                    title="Edit variant"

                    :ui="{ base: 'border border-slate-200 bg-white text-slate-500 w-[30px] h-[30px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                    @click="onViewDetail"
                  >
                    <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" />
                  </UButton>
                </div>
              </template>
            </UTable>
          </div>

          <!-- pagination -->
          <div class="flex items-center justify-between px-4 py-3.5 border-t border-slate-200">
            <span class="text-[13px] text-slate-500">{{ paginationLabel }}</span>
            <div class="flex items-center gap-1">
              <button :disabled="isFirstPage" :style="pagerNavStyle" @click="goToPage(1)">
                <UIcon name="i-lucide-chevrons-left" class="w-[15px] h-[15px]" />
              </button>
              <button :disabled="isFirstPage" :style="pagerNavStyle" @click="goToPage(clampedPage - 1)">
                <UIcon name="i-lucide-chevron-left" class="w-[15px] h-[15px]" />
              </button>
              <button
                v-for="pn in pageNumbers"
                :key="pn"
                :style="pageBtnStyle(pn)"
                @click="goToPage(pn)"
              >
                {{ pn }}
              </button>
              <button :disabled="isLastPage" :style="pagerNavStyle" @click="goToPage(clampedPage + 1)">
                <UIcon name="i-lucide-chevron-right" class="w-[15px] h-[15px]" />
              </button>
              <button :disabled="isLastPage" :style="pagerNavStyle" @click="goToPage(totalPages)">
                <UIcon name="i-lucide-chevrons-right" class="w-[15px] h-[15px]" />
              </button>
            </div>
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
