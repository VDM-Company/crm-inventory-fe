<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AttributeDef, StoredProduct } from '~/types'

useHead({ title: 'Attributes — Vertex' })

// ── state (mirrors the design's DCLogic state) ──
const attrs = ref<AttributeDef[]>([])
const { message: toast, show: showToast } = usePageToast(2800)
const products = ref<StoredProduct[]>([])
const loading = ref(true)
const loadError = ref('')

// UTable column defs — per-column padding/width via `meta.class`, matching the
// design's first/last-column gutters.
const columns: TableColumn<AttributeDef>[] = [
  { accessorKey: 'name', header: 'Attribute Name', meta: { class: { th: 'px-5 w-[220px]', td: TABLE_EDGE.td } } },
  { accessorKey: 'type', header: 'Type', meta: { class: { th: 'w-[130px]' } } },
  { accessorKey: 'values', header: 'Values' },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-5 text-right w-[130px]', td: TABLE_EDGE.td } } }
]

onMounted(async () => {
  try {
    ;[attrs.value, products.value] = await Promise.all([loadAttributeDefs(), loadProducts()])
  } catch (err) {
    loadError.value = apiErrorMessage(err, 'Could not load attributes.')
  } finally {
    loading.value = false
  }
})

// ── create / edit (a dedicated screen, not an inline modal) ──
function onCreate() {
  return navigateTo('/attributes/create')
}
function onEdit(a: AttributeDef) {
  return navigateTo({ path: '/attributes/create', query: { id: a.id } })
}

// ── delete ──
const {
  target: deleteTarget,
  blocked: deleteBlocked,
  icon: deleteIcon,
  title: deleteTitle,
  message: deleteMessage,
  cancelLabel: deleteCancelLabel,
  confirm: confirmDelete,
  cancel: cancelDelete
} = useResourceDelete<AttributeDef>({
  resource: 'attributes',
  noun: 'attribute',
  usageCount: t => attributeUsageCount(products.value, t.name),
  blockedMessage: u => `This attribute is used by ${u} product${u === 1 ? '' : 's'}. Remove it from them first.`,
  onDeleted: (t) => {
    attrs.value = attrs.value.filter(x => x.id !== t.id)
  },
  notify: showToast
})
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Configuration' },
        { label: 'Attributes' }
      ]"
    />

    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mt-0 mb-1">
          Attributes
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Reusable variant attributes and their values.
        </p>
      </div>
      <UButton
        variant="ghost"

        :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:bg-green-600 transition-colors' }"
        @click="onCreate"
      >
        <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Attribute
      </UButton>
    </div>

    <UCard class="overflow-hidden">
      <VertexTableSkeleton v-if="loading" :columns="['25%', '15%', '45%', '12%']" />

      <VertexErrorBanner v-else-if="loadError" :message="loadError" class="m-5" />

      <div v-else-if="attrs.length" class="overflow-x-auto">
        <UTable
          :data="attrs"
          :columns="columns"
          :ui="tableUi('min-w-[640px]')"
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2.5">
              <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                <UIcon name="i-lucide-tag" class="w-4 h-4" />
              </div>
              <span class="text-base font-semibold text-slate-900">{{ row.original.name }}</span>
            </div>
          </template>

          <template #type-cell="{ row }">
            <span class="text-sm text-slate-700">{{ row.original.type || 'Select' }}</span>
          </template>

          <template #values-cell="{ row }">
            <div v-if="row.original.values.length" class="flex flex-wrap gap-[5px]">
              <span
                v-for="v in row.original.values"
                :key="v"
                class="text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-0.5 whitespace-nowrap"
              >{{ v }}</span>
            </div>
            <span v-else class="text-sm text-slate-300">No values yet</span>
          </template>

          <template #action-cell="{ row }">
            <div class="flex items-center justify-end gap-2">
              <UButton
                variant="ghost"

                :ui="{ base: 'hover:bg-slate-100 inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3.5 py-[7px] rounded-lg cursor-pointer' }"
                @click="onEdit(row.original)"
              >
                <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
              </UButton>
              <UButton
                variant="ghost"

                title="Delete attribute"

                :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-600 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                @click="deleteTarget = row.original"
              >
                <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
              </UButton>
            </div>
          </template>
        </UTable>
      </div>

      <VertexEmptyState
        v-else
        icon="tags"
        title="No attributes yet"
        hint="Create an attribute to reuse it across product variants."
      />
    </UCard>

    <!-- delete modal -->
    <VertexConfirmModal
      :open="!!deleteTarget"
      :title="deleteTitle"
      :message="deleteMessage"
      :icon="deleteIcon"
      :tone="deleteBlocked ? 'warning' : 'danger'"
      :cancel-label="deleteCancelLabel"
      :show-confirm="!deleteBlocked"
      @cancel="cancelDelete"
      @confirm="confirmDelete"
    />

    <!-- toast -->
    <VertexToast :message="toast" />
  </div>
</template>
