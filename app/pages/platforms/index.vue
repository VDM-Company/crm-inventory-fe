<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Platform } from '~/types'

useHead({ title: 'Platforms — Vertex' })

// ── state (mirrors the design's DCLogic state) ──
const platforms = ref<Platform[]>([...PLATFORM_SEED])
const deleteTarget = ref<Platform | null>(null)
const toast = ref<string | null>(null)

let toastTimer: number | null = null

onMounted(() => {
  platforms.value = loadPlatforms()
  // cross-page success toast set by the Create Platform screen
  try {
    const t = sessionStorage.getItem('vertex_platform_toast')
    if (t) {
      sessionStorage.removeItem('vertex_platform_toast')
      showToast(t)
    }
  } catch {
    // ignore
  }
})
onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer !== null) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 3000)
}

const columns: TableColumn<Platform>[] = [
  { accessorKey: 'name', header: 'Platform Name', meta: { class: { th: 'px-5', td: TABLE_EDGE.td } } },
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'url', header: 'URL / Path' },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-5 text-right', td: TABLE_EDGE.td } } }
]

function editHref(id: string) {
  return { path: '/platforms/config', query: { id } }
}

// ── delete ──
const deleteAssigned = computed(() => deleteTarget.value ? platformAssignedCount(deleteTarget.value.id) : 0)
const deleteBlocked = computed(() => deleteAssigned.value > 0)
function confirmDelete() {
  const t = deleteTarget.value
  if (!t || deleteBlocked.value) return
  const next = platforms.value.filter(p => p.id !== t.id)
  savePlatforms(next)
  platforms.value = next
  deleteTarget.value = null
  showToast('Platform deleted')
}
const deleteIcon = computed(() => deleteBlocked.value ? 'shield-alert' : 'trash-2')
const deleteTitle = computed(() => {
  const t = deleteTarget.value
  if (!t) return ''
  return deleteBlocked.value ? 'Cannot delete platform' : 'Delete ' + t.name + '?'
})
const deleteMessage = computed(() => {
  if (!deleteTarget.value) return ''
  if (!deleteBlocked.value) return 'This action cannot be undone.'
  const a = deleteAssigned.value
  return `This platform is assigned to ${a} product${a === 1 ? '' : 's'}. Unassign it first.`
})
const deleteCancelLabel = computed(() => deleteBlocked.value ? 'Close' : 'Cancel')
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Platforms' }
      ]"
    />

    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mt-0 mb-1">
          Platforms
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Sales channels under Vertex Digital Marketing.
        </p>
      </div>
      <div class="flex items-center gap-2.5">
        <NuxtLink
          to="/platforms/create"
          class="border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 no-underline shadow-sm hover:bg-green-600 transition-colors"
        >
          <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Platform
        </NuxtLink>
      </div>
    </div>

    <UCard class="overflow-hidden">
      <div v-if="platforms.length" class="overflow-x-auto">
        <UTable
          :data="platforms"
          :columns="columns"
          :ui="tableUi('min-w-[640px]')"
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2.5">
              <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                <UIcon name="i-lucide-globe" class="w-[17px] h-[17px]" />
              </div>
              <span class="text-base font-semibold text-slate-900">{{ row.original.name }}</span>
            </div>
          </template>

          <template #code-cell="{ row }">
            <span class="font-mono text-[13px] text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-[3px]">{{ row.original.code }}</span>
          </template>

          <template #url-cell="{ row }">
            <span class="text-[15px] text-slate-700">{{ row.original.url }}</span>
          </template>

          <template #action-cell="{ row }">
            <div class="flex items-center justify-end gap-2">
              <NuxtLink
                :to="editHref(row.original.id)"
                class="btn-icon-hover inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3.5 py-[7px] rounded-lg no-underline"
              >
                <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
              </NuxtLink>
              <UButton
                variant="ghost"

                title="Delete platform"

                :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-red-600 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
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
        icon="globe"
        title="No platforms yet"
        hint="Create your first platform to start assigning products to sales channels."
      >
        <NuxtLink
          to="/platforms/create"
          class="mt-2 border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 no-underline"
        >
          <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Platform
        </NuxtLink>
      </VertexEmptyState>
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
      @cancel="deleteTarget = null"
      @confirm="confirmDelete"
    />

    <!-- toast -->
    <VertexToast :message="toast" />
  </div>
</template>
