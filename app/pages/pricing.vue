<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { FeeItem } from '~/types'

useHead({ title: 'Pricing Setting — Vertex' })

interface ModalState {
  id: string | null
  /** Immutable once created, so the input only shows on a create. */
  code: string
  name: string
  desc: string
  icon: string
  /** The version this row carried when it was read; required on a save. */
  lockVersion: number
  /** Stop auto-slugging the code once someone has typed their own. */
  codeTouched: boolean
  error: string
}

// Fallback icon per seeded component, keyed by the API's `code`. The API
// carries an `icon` of its own; this only covers the seeded rows, which have
// none.
const ICONS: Record<string, string> = {
  base_price: 'anchor',
  tax: 'receipt',
  shipping: 'truck',
  handling: 'package',
  insurance: 'shield-check'
}
const DEFAULT_ICON = 'circle-dollar-sign'
const ICON_CHOICES = [
  'circle-dollar-sign', 'receipt', 'truck', 'package',
  'shield-check', 'tag', 'percent', 'coins',
  'wallet', 'credit-card', 'gift', 'wrench',
  'box', 'banknote', 'hand-coins', 'badge-percent'
]

// ── state (mirrors the design's DCLogic state) ──
const fees = ref<FeeItem[]>([])
const loading = ref(true)
const loadError = ref('')
const modal = ref<ModalState | null>(null)
const { message: toast, show: showToast } = usePageToast()

const feesApi = useApiFeeItems()

// No product fetch any more: the API reports `usageCount` per fee item, which
// is the only thing this screen ever loaded products for.
onMounted(async () => {
  try {
    fees.value = await feesApi.list()
  } catch (err) {
    loadError.value = apiErrorMessage(err, 'Could not load pricing components.')
  } finally {
    loading.value = false
  }
})

const columns: TableColumn<FeeItem>[] = [
  { accessorKey: 'name', header: 'Component Name', meta: { class: { th: 'px-5', td: TABLE_EDGE.td } } },
  { id: 'action', header: 'Action', meta: { class: { th: 'px-5 text-right w-[130px]', td: TABLE_EDGE.td } } }
]

function iconOf(f: FeeItem) {
  return f.icon || ICONS[f.code] || DEFAULT_ICON
}
const nameOf = (f: FeeItem) => localized(f.name)
const descOf = (f: FeeItem) => localized(f.description)
function iconChoiceStyle(selected: boolean) {
  return `width:42px;height:42px;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;background:${selected ? '#ecfdf5' : '#fff'};border:1px solid ${selected ? '#00c16a' : '#e2e8f0'};color:${selected ? '#00a155' : '#64748b'};`
}
function pickIcon(name: string) {
  if (modal.value) modal.value = { ...modal.value, icon: name }
}
function editStyleOf(system: boolean) {
  return 'display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;color:' + (system ? '#cbd5e1' : '#334155') + ';font-size:14px;font-weight:600;padding:7px 14px;border-radius:8px;cursor:' + (system ? 'not-allowed' : 'pointer') + ';'
}

// ── create / edit ──
function onCreate() {
  modal.value = {
    id: null, code: '', name: '', desc: '', icon: DEFAULT_ICON,
    lockVersion: 0, codeTouched: false, error: ''
  }
}
function onEdit(f: FeeItem) {
  if (f.isSystem) return
  modal.value = {
    id: f.id,
    code: f.code,
    name: nameOf(f),
    desc: descOf(f),
    icon: iconOf(f),
    lockVersion: f.lockVersion,
    codeTouched: true,
    error: ''
  }
}

// The code is derived from the name until someone types their own, so nobody
// has to invent one — but it stays editable, and the API owns the rule.
function onNameInput(value: string) {
  if (!modal.value) return
  modal.value.name = value
  if (!modal.value.id && !modal.value.codeTouched) modal.value.code = slugifyCode(value)
}
function onCodeInput(value: string) {
  if (!modal.value) return
  modal.value.code = value
  modal.value.codeTouched = true
}

const saveDisabled = computed(() => {
  const m = modal.value
  if (!m?.name.trim()) return true
  // `code` is only sent on a create; the API does not accept changes to it
  return !m.id && !FEE_ITEM_CODE_PATTERN.test(m.code)
})

// A computed so the uniqueness checks see the current list and the row being
// edited.
const modalSchema = computed(() => z.object({
  name: z.string()
    .trim()
    .min(1, 'Component name is required.')
    .refine(
      v => !fees.value.some(f => nameOf(f).toLowerCase() === v.toLowerCase() && f.id !== modal.value?.id),
      'A component with this name already exists.'
    ),
  code: z.string()
    .trim()
    .regex(FEE_ITEM_CODE_PATTERN, 'Use 2–50 lowercase letters, digits or underscores.')
    .refine(
      v => !fees.value.some(f => f.code === v && f.id !== modal.value?.id),
      'A component with this code already exists.'
    )
    .optional()
}))
type ModalSchema = { name: string, code?: string }

/**
 * Put a row the server just refused back in step.
 *
 * A 409 `stale_version` means someone else saved first, so the version in
 * hand is no longer the one to send. Re-reading the record fixes the next
 * attempt instead of leaving the form permanently unable to save.
 */
async function refreshRow(id: string) {
  try {
    const fresh = await feesApi.get(id)
    fees.value = fees.value.map(f => f.id === id ? fresh : f)
    if (modal.value?.id === id) modal.value.lockVersion = fresh.lockVersion
  } catch {
    // the row may be gone entirely; the list reload on next visit will say so
  }
}

async function onModalSubmit(event: FormSubmitEvent<ModalSchema>) {
  const m = modal.value
  if (!m) return
  const name = { en: event.data.name }
  const description = m.desc.trim() ? { en: m.desc.trim() } : null

  try {
    if (m.id) {
      const saved = await feesApi.update(m.id, { name, description, icon: m.icon }, m.lockVersion)
      fees.value = fees.value.map(f => f.id === m.id ? saved : f)
    } else {
      const saved = await feesApi.create({
        code: event.data.code ?? m.code,
        name,
        kind: 'other',
        description,
        icon: m.icon || DEFAULT_ICON
      })
      fees.value = [...fees.value, saved]
    }
  } catch (err) {
    if (apiErrorCode(err) === 'stale_version' && m.id) {
      await refreshRow(m.id)
      showToast('Someone else changed this component. It has been reloaded — try saving again.')
      return
    }
    showToast(apiErrorMessage(err, 'Could not save the component.'))
    return
  }
  modal.value = null
  showToast(m.id ? 'Component updated' : 'Component created')
}

// ── delete ──
// The shared delete flow renders `name` in its modal copy, so the row handed
// to it carries the resolved string in place of the locale map.
type DeletableFee = Omit<FeeItem, 'name'> & { name: string }

const {
  target: deleteTarget,
  blocked: deleteBlocked,
  icon: deleteIcon,
  title: deleteTitle,
  message: deleteMessage,
  cancelLabel: deleteCancelLabel,
  confirm: confirmDelete,
  cancel: cancelDelete
} = useResourceDelete<DeletableFee>({
  remove: feesApi.remove,
  noun: 'component',
  // straight from the server, which counts price lines including history —
  // this screen used to load every product to work it out
  usageCount: t => t.usageCount,
  blockedMessage: u => `This component is used by ${u} price line${u === 1 ? '' : 's'}. Remove it from them first.`,
  isLocked: t => t.isSystem,
  onDeleted: (t) => {
    fees.value = fees.value.filter(f => f.id !== t.id)
  },
  notify: showToast
})

/** `useResourceDelete` wants a plain `name` for its modal copy. */
const askDelete = (f: FeeItem) => {
  deleteTarget.value = { ...f, name: nameOf(f) }
}
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Product', to: '/dashboard' },
        { label: 'Configuration' },
        { label: 'Pricing Setting' }
      ]"
    />

    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mt-0 mb-1">
          Pricing Setting
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          Reusable Initial Fee line-items used across product pricing.
        </p>
      </div>
      <UButton
        variant="ghost"

        :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[18px] py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-sm hover:bg-green-600 transition-colors' }"
        @click="onCreate"
      >
        <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Create Component
      </UButton>
    </div>

    <UCard class="overflow-hidden">
      <VertexTableSkeleton v-if="loading" :columns="['35%', '45%', '12%']" />

      <VertexErrorBanner v-else-if="loadError" :message="loadError" class="m-5" />

      <div v-else class="overflow-x-auto">
        <UTable
          :data="fees"
          :columns="columns"
          :ui="tableUi('min-w-[560px]')"
        >
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2.5">
              <div class="w-[34px] h-[34px] rounded-lg bg-emerald-50 text-green-600 flex items-center justify-center flex-shrink-0">
                <UIcon :name="'i-lucide-' + iconOf(row.original)" class="w-4 h-4" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-base font-semibold text-slate-900">{{ nameOf(row.original) }}</span>
                  <span
                    v-if="row.original.isSystem"
                    class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
                  >Default</span>
                </div>
                <div v-if="descOf(row.original)" class="text-[13px] text-slate-400 mt-0.5">
                  {{ descOf(row.original) }}
                </div>
              </div>
            </div>
          </template>

          <template #action-cell="{ row }">
            <div class="flex items-center justify-end gap-2">
              <button
                :disabled="row.original.isSystem"
                class="hover:bg-slate-100"
                :style="editStyleOf(row.original.isSystem)"
                @click="onEdit(row.original)"
              >
                <UIcon name="i-lucide-pencil" class="w-3.5 h-3.5" /> Edit
              </button>
              <UButton
                v-if="!row.original.isSystem"

                variant="ghost"
                title="Delete component"

                :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-600 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
                @click="askDelete(row.original)"
              >
                <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
              </UButton>
              <span
                v-else
                title="System component — locked"
                class="w-[34px] h-[34px] rounded-lg inline-flex items-center justify-center text-slate-300"
              >
                <UIcon name="i-lucide-lock" class="w-[15px] h-[15px]" />
              </span>
            </div>
          </template>
        </UTable>
      </div>
    </UCard>

    <!-- create / edit modal -->
    <div
      v-if="modal"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[200] p-5"
    >
      <div class="bg-white rounded-[14px] w-[480px] max-w-[94vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 class="text-[17px] font-bold text-slate-900 m-0">
            {{ modal.id ? 'Edit Component' : 'Create Component' }}
          </h3>
          <UButton
            variant="ghost"

            :ui="{ base: 'hover:bg-slate-100 border-none bg-transparent text-slate-500 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center' }"
            @click="modal = null"
          >
            <UIcon name="i-lucide-x" class="w-[18px] h-[18px]" />
          </UButton>
        </div>
        <UForm :schema="modalSchema" :state="modal" @submit="onModalSubmit">
          <div class="p-6">
            <UFormField
              name="name"
              label="Component Name"
              required
              class="mb-[18px]"
            >
              <UInput
                :model-value="modal.name"
                placeholder="e.g. Handling"
                @update:model-value="onNameInput(String($event))"
              />
            </UFormField>
            <UFormField
              v-if="!modal.id"
              name="code"
              label="Code"
              required
              class="mb-[18px]"
              help="Identifies this component to the API. Lowercase letters, digits and underscores."
            >
              <UInput
                :model-value="modal.code"
                placeholder="e.g. handling_fee"
                @update:model-value="onCodeInput(String($event))"
              />
            </UFormField>
            <div v-else class="mb-[18px]">
              <label class="field-label">Code</label>
              <p class="text-[13px] text-slate-400 m-0">
                <code class="text-slate-600">{{ modal.code }}</code> — set when the component was created and
                cannot be changed.
              </p>
            </div>
            <div class="mb-[18px]">
              <label class="field-label">Icon</label>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="ic in ICON_CHOICES"
                  :key="ic"
                  type="button"
                  :title="ic"
                  :style="iconChoiceStyle(modal.icon === ic)"
                  @click="pickIcon(ic)"
                >
                  <UIcon :name="'i-lucide-' + ic" class="w-[18px] h-[18px]" />
                </button>
              </div>
            </div>
            <div>
              <label class="field-label">Description <span class="text-slate-400 font-normal">(optional)</span></label>
              <UInput
                v-model="modal.desc"
                placeholder="Short note about this fee"
              />
            </div>
          </div>
          <div class="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100">
            <UButton
              variant="ghost"

              :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer' }"
              @click="modal = null"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              variant="ghost"
              :disabled="saveDisabled"
              :ui="{ base: ['border-none text-[15px] font-bold px-5 py-[9px] rounded-lg transition-colors', saveDisabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-green-500 text-white cursor-pointer hover:bg-green-600'] }"
            >
              Save
            </UButton>
          </div>
        </UForm>
      </div>
    </div>

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
