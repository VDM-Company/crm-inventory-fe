<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { VertexPlatform } from '~/types'

useHead({ title: 'Platforms — Vertex' })

// ── state (mirrors the design's DCLogic state) ──
const platforms = ref<VertexPlatform[]>([])
const loading = ref(true)
const loadError = ref('')
const { message: toast, show: showToast } = usePageToast(3000)

const platformsApi = useApiPlatformsV2()

// No product fetch any more. It was here to block deleting a platform that
// still had products, and the API has no delete — a platform is switched off
// instead, which is safe whatever is assigned to it.
onMounted(async () => {
  try {
    platforms.value = await platformsApi.list()
  } catch (err) {
    loadError.value = apiErrorMessage(err, 'Could not load platforms.')
  } finally {
    loading.value = false
  }
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

const columns: TableColumn<VertexPlatform>[] = [
  { accessorKey: 'name', header: 'Platform Name', meta: { class: { th: 'px-5', td: TABLE_EDGE.td } } },
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'domain', header: 'Domain' },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-5 text-right', td: TABLE_EDGE.td } } }
]

function editHref(id: string) {
  return { path: '/platforms/config', query: { id } }
}

// ── activate / deactivate ──
// There is no delete: the API switches a platform off and back on, and the
// record keeps its `isActive`. Switching off is the one that needs a
// confirmation, because it is what takes a channel off the storefront.
const pendingOff = ref<VertexPlatform | null>(null)
const busyId = ref('')

function replaceRow(next: VertexPlatform) {
  platforms.value = platforms.value.map(p => p.id === next.id ? next : p)
}

async function setActive(p: VertexPlatform, active: boolean) {
  busyId.value = p.id
  try {
    replaceRow(active ? await platformsApi.activate(p.id) : await platformsApi.deactivate(p.id))
    showToast(active ? `${p.name} is active again` : `${p.name} is no longer active`)
  } catch (err) {
    showToast(apiErrorMessage(err, `Could not ${active ? 'activate' : 'deactivate'} the platform.`))
  } finally {
    busyId.value = ''
    pendingOff.value = null
  }
}
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
      <VertexTableSkeleton v-if="loading" :columns="['30%', '15%', '35%', '12%']" />

      <VertexErrorBanner v-else-if="loadError" :message="loadError" class="m-5" />

      <div v-else-if="platforms.length" class="overflow-x-auto">
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
              <span
                v-if="!row.original.isActive"
                class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200"
              >Inactive</span>
            </div>
          </template>

          <template #code-cell="{ row }">
            <span class="font-mono text-[13px] text-slate-600 bg-slate-100 border border-slate-200 rounded-md px-2 py-[3px]">{{ row.original.code }}</span>
          </template>

          <template #domain-cell="{ row }">
            <span class="text-[15px] text-slate-700">{{ row.original.domain }}</span>
          </template>

          <template #action-cell="{ row }">
            <div class="flex items-center justify-end gap-2">
              <NuxtLink
                :to="editHref(row.original.id)"
                class="hover:bg-slate-100 inline-flex items-center gap-1.5 border border-slate-200 bg-white text-slate-700 text-sm font-semibold px-3.5 py-[7px] rounded-lg no-underline"
              >
                <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
              </NuxtLink>
              <UButton
                variant="ghost"
                :disabled="busyId === row.original.id"
                :title="row.original.isActive ? 'Deactivate platform' : 'Activate platform'"
                :ui="{ base: ['hover:bg-slate-100 border border-slate-200 bg-white w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center', row.original.isActive ? 'text-slate-600' : 'text-green-600'] }"
                @click="row.original.isActive ? (pendingOff = row.original) : setActive(row.original, true)"
              >
                <UIcon :name="row.original.isActive ? 'i-lucide-power-off' : 'i-lucide-power'" class="w-[15px] h-[15px]" />
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

    <!-- deactivate confirmation -->
    <VertexConfirmModal
      :open="!!pendingOff"
      :title="pendingOff ? `Deactivate ${pendingOff.name}?` : ''"
      message="Products stay assigned to it, but the platform stops serving them. You can switch it back on at any time."
      icon="power-off"
      tone="warning"
      confirm-label="Deactivate"
      @cancel="pendingOff = null"
      @confirm="pendingOff && setActive(pendingOff, false)"
    />

    <!-- toast -->
    <VertexToast :message="toast" />
  </div>
</template>
