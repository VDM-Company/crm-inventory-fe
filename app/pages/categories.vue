<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, TableColumn } from '@nuxt/ui'
import type { Category, CatEntry, CatScopeEntry, Platform } from '~/types'

useHead({ title: 'Categories — Vertex' })

interface CatalogProduct {
  id: string
  displayId: string
  name: string
  sku: string
  status: string
  price: number
}
// A catalog product as rendered in the membership table.
type CatalogRow = CatalogProduct & { included: boolean, pos?: number }

interface AddModalState {
  parentId: string | null
  name: string
  error: boolean
  enabled: boolean
  inMenu: boolean
  forceSub?: boolean
}

// ── state (mirrors the design's DCLogic state) ──
const treeCollapsed = ref(false)
const cats = ref<Category[]>([])
const platforms = ref<Platform[]>([])
const selectedId = ref<string | null>(null)
const expanded = ref<Record<string, boolean>>({})
const draftName = ref('')
const draftEnabled = ref(true)
const nameError = ref(false)
const scope = ref('default')
const scopeOpen = ref(false)
const scopeInfoDismissed = ref(false)
const members = ref<string[]>([])
const positions = ref<Record<string, Record<string, number>>>({ default: {} })
const scopeOverride = ref<Record<string, boolean>>({})
const search = ref('')
const page = ref(1)
const addModal = ref<AddModalState | null>(null)
const deleteOpen = ref(false)
const toast = ref<string | null>(null)

let toastTimer: number | null = null

onMounted(async () => {
  let list: Category[] = []
  try {
    ;[list, platforms.value] = await Promise.all([loadCategories(), loadPlatforms()])
  } catch (err) {
    showToast(apiErrorMessage(err, 'Could not load categories.'))
    return
  }
  cats.value = list
  const exp: Record<string, boolean> = {}
  list.forEach((c) => {
    if (!c.parentId) exp[c.id] = true
  })
  expanded.value = exp
  const first = list.find(c => !c.parentId) || list[0] || null
  if (first) await select(first.id)
})

onBeforeUnmount(() => {
  if (toastTimer !== null) clearTimeout(toastTimer)
})

// ── style helpers (ported) ──
function ddTrigger(open: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid ${open ? '#00c16a' : '#e2e8f0'};border-radius:8px;padding:9px 12px;height:40px;font-size:14px;background:#fff;cursor:pointer;color:#0f172a;${open ? 'box-shadow:0 0 0 3px rgba(0,193,106,0.15);' : ''}`
}
function ddChevron(open: boolean) {
  return `display:inline-flex;align-items:center;color:#64748b;flex-shrink:0;transition:transform 150ms ease;transform:rotate(${open ? '180deg' : '0deg'});`
}

// ── deterministic catalog (design's hash-based catalogFor) ──
function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}
const SUFFIXES = ['Basic', 'Standard', 'Plus', 'Pro', 'Max', 'Lite', 'Mini', 'Ultra', 'Air', 'Go', 'Prime', 'Edge', 'Neo', 'One', 'Flex']
function catalogFor(catId: string): CatalogProduct[] {
  const cat = categoryById(cats.value, catId)
  if (!cat) return []
  const base = hashCode(catId)
  const out: CatalogProduct[] = []
  for (let n = 0; n < 15; n++) {
    const seed = base + n * 97
    const idNum = 3000 + (base % 4000) + n
    out.push({
      id: catId + '_p' + (n + 1),
      displayId: String(idNum),
      name: cat.name + ' ' + SUFFIXES[n % SUFFIXES.length] + ' ' + (n + 1),
      sku: 'SKU-' + (base % 9000 + 1000) + '-' + String(n + 1).padStart(2, '0'),
      status: (seed % 5 === 0) ? 'Inactive' : 'Active',
      price: 8 + (seed % 92)
    })
  }
  return out
}
function leafDescendants(catId: string): string[] {
  const kids = categoryChildren(cats.value, catId)
  if (!kids.length) return [catId]
  let acc: string[] = []
  kids.forEach((k) => {
    acc = acc.concat(leafDescendants(k.id))
  })
  return acc
}
function productsForCategory(catId: string): CatalogProduct[] {
  let acc: CatalogProduct[] = []
  leafDescendants(catId).forEach((lid) => {
    acc = acc.concat(catalogFor(lid))
  })
  return acc
}
function productCount(catId: string): number {
  return leafDescendants(catId).length * 15
}

// ── selection ──
// Clicks can outpace responses, so a slow fetch for one node must not land
// after a later one and overwrite it.
let selectSeq = 0

async function select(id: string) {
  const cat = categoryById(cats.value, id)
  if (!cat) return
  const seq = ++selectSeq
  let entry: CatEntry
  try {
    entry = await categoryEntry(id)
  } catch (err) {
    if (seq === selectSeq) showToast(apiErrorMessage(err, 'Could not load this category.'))
    return
  }
  if (seq !== selectSeq) return
  const pos: Record<string, Record<string, number>> = {}
  const ov: Record<string, boolean> = {}
  Object.keys(entry.scopes || {}).forEach((k) => {
    pos[k] = { ...(entry.scopes[k]!.positions || {}) }
    if (k !== 'default') ov[k] = !!entry.scopes[k]!.override
  })
  if (!pos.default) pos.default = {}
  // keep ancestors expanded so the selected node stays visible
  const anc: Record<string, boolean> = {}
  let pid = cat.parentId
  let guard = 0
  while (pid && guard++ < 20) {
    anc[pid] = true
    const p = categoryById(cats.value, pid)
    pid = p ? p.parentId : null
  }
  const catalogIds = productsForCategory(id).map(p => p.id)
  const mem = (entry.members && entry.members.length) ? entry.members.slice() : catalogIds.slice()
  if (!Object.keys(pos.default).length) {
    catalogIds.forEach((cid, i) => {
      pos.default![cid] = i + 1
    })
  }
  selectedId.value = id
  draftName.value = cat.name
  draftEnabled.value = cat.enabled !== false
  nameError.value = false
  members.value = mem
  positions.value = pos
  scopeOverride.value = ov
  scope.value = 'default'
  search.value = ''
  page.value = 1
  expanded.value = { ...expanded.value, ...anc }
}

function toggleExpand(id: string) {
  expanded.value = { ...expanded.value, [id]: !expanded.value[id] }
}

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer !== null) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.value = null
  }, 2600)
}

// ── add / delete / save ──
// Uniqueness is scoped to the chosen parent, so the schema is a computed that
// closes over the modal's current parentId.
const addSchema = computed(() => z.object({
  name: z.string()
    .trim()
    .min(1, 'Enter a unique category name.')
    .refine(
      v => !cats.value.some(c =>
        c.name.toLowerCase() === v.toLowerCase()
        && (c.parentId || null) === (addModal.value?.parentId || null)
      ),
      'Enter a unique category name.'
    )
}))
type AddSchema = { name: string }

async function onAddSubmit(event: FormSubmitEvent<AddSchema>) {
  const m = addModal.value
  if (!m) return
  const name = event.data.name
  // the parent picker is outside the schema; a forced subcategory needs one
  if (m.forceSub && !m.parentId) {
    addModal.value = { ...m, error: true }
    return
  }
  let cat: Category
  try {
    cat = await apiCreate<Category>('categories', {
      name, parentId: m.parentId || null, enabled: m.enabled !== false
    })
  } catch (err) {
    showToast(apiErrorMessage(err, 'Could not create the category.'))
    return
  }
  cats.value = [...cats.value, cat]
  if (m.parentId) expanded.value = { ...expanded.value, [m.parentId]: true }
  addModal.value = null
  await select(cat.id)
  showToast(m.parentId ? 'Subcategory created' : 'Category created')
}

const blockedDelete = computed(() => {
  const sel = selectedId.value
  if (!sel) return false
  return categoryChildren(cats.value, sel).length > 0 || members.value.length > 0
})
async function confirmDelete() {
  const id = selectedId.value
  if (!id) return
  if (categoryChildren(cats.value, id).length || members.value.length) return
  try {
    await apiRemove('categories', id)
  } catch (err) {
    deleteOpen.value = false
    showToast(apiErrorMessage(err, 'Could not delete the category.'))
    return
  }
  const next = cats.value.filter(c => c.id !== id)
  cats.value = next
  const nextSel = next.find(c => !c.parentId) || next[0] || null
  deleteOpen.value = false
  selectedId.value = null
  if (nextSel) await select(nextSel.id)
  showToast('Category deleted')
}

const isPlatformScope = computed(() => scope.value !== 'default')
const overridden = computed(() => isPlatformScope.value && !!scopeOverride.value[scope.value])
const posLocked = computed(() => isPlatformScope.value && !overridden.value)

function effectivePositions(): Record<string, number> {
  if (scope.value === 'default') return positions.value.default || {}
  if (scopeOverride.value[scope.value]) return positions.value[scope.value] || {}
  return positions.value.default || {}
}
function setPosition(pid: string, value: string) {
  const key = (scope.value === 'default' || !scopeOverride.value[scope.value]) ? 'default' : scope.value
  const n = parseInt(value, 10)
  const prev = positions.value[key] || {}
  const cur: Record<string, number> = {}
  Object.keys(prev).forEach((k) => {
    if (k !== pid) cur[k] = prev[k]!
  })
  if (!(value === '' || isNaN(n) || n < 1)) cur[pid] = n
  positions.value = { ...positions.value, [key]: cur }
}
function toggleMember(pid: string) {
  if (isPlatformScope.value) return
  members.value = members.value.indexOf(pid) === -1
    ? [...members.value, pid]
    : members.value.filter(x => x !== pid)
}
function onToggleUseDefaultOrder(e: Event) {
  const useDefault = (e.target as HTMLInputElement).checked
  const sc = scope.value
  scopeOverride.value = { ...scopeOverride.value, [sc]: !useDefault }
  if (!useDefault && !positions.value[sc]) {
    positions.value = { ...positions.value, [sc]: { ...(positions.value.default || {}) } }
  }
}

const saving = ref(false)

async function save() {
  const name = (draftName.value || '').trim()
  if (!name) {
    nameError.value = true
    return
  }
  const id = selectedId.value
  if (!id || saving.value) return
  const scopes: Record<string, CatScopeEntry> = {}
  Object.keys(positions.value).forEach((k) => {
    scopes[k] = { positions: positions.value[k] || {} }
    if (k !== 'default') scopes[k].override = !!scopeOverride.value[k]
  })
  Object.keys(scopeOverride.value).forEach((k) => {
    if (!scopes[k]) scopes[k] = { positions: {}, override: !!scopeOverride.value[k] }
  })
  saving.value = true
  try {
    await apiUpdate<Category>('categories', id, { name, enabled: draftEnabled.value })
    await saveCategoryEntry(id, { members: members.value, scopes } as CatEntry)
  } catch (err) {
    saving.value = false
    showToast(apiErrorMessage(err, 'Could not save the category.'))
    return
  }
  saving.value = false
  cats.value = cats.value.map(c => c.id === id ? { ...c, name, enabled: draftEnabled.value } : c)
  nameError.value = false
  showToast('Category saved')
}

// ── tree rows (respect collapsed ancestors) ──
const visibleRows = computed(() =>
  categoryTreeRows(cats.value).filter((r) => {
    let pid = r.parentId
    let guard = 0
    while (pid && guard++ < 20) {
      if (!expanded.value[pid]) return false
      const p = categoryById(cats.value, pid)
      pid = p ? p.parentId : null
    }
    return true
  })
)
function treeRowStyle(id: string, depth: number) {
  const sel = id === selectedId.value
  return `display:flex;align-items:center;gap:7px;padding:7px 8px;border-radius:8px;cursor:pointer;margin-left:${depth * 16}px;${sel ? 'background:#ecfdf5;' : ''}`
}
function treeLabelStyle(id: string) {
  const sel = id === selectedId.value
  return `flex:1;min-width:0;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${sel ? '#047857' : '#334155'};font-weight:${sel ? 700 : 500};`
}
function treeCountStyle(id: string) {
  const sel = id === selectedId.value
  return `font-size:11px;font-weight:600;color:${sel ? '#047857' : '#94a3b8'};background:${sel ? '#d1fae5' : '#f1f5f9'};border-radius:999px;padding:1px 8px;flex-shrink:0;`
}
function treeIcon(childCount: number, id: string) {
  return childCount > 0 ? (expanded.value[id] ? 'folder-open' : 'folder') : 'tag'
}
function railStyle(id: string) {
  const sel = id === selectedId.value
  return `border:none;background:${sel ? '#ecfdf5' : 'transparent'};color:${sel ? '#047857' : '#94a3b8'};border-radius:8px;cursor:pointer;height:34px;display:flex;align-items:center;justify-content:center;transition:background 120ms ease;`
}

function onExpandAll() {
  const e: Record<string, boolean> = {}
  categoryTreeRows(cats.value).forEach((r) => {
    if (r.childCount) e[r.id] = true
  })
  expanded.value = e
}
function onCollapseAll() {
  expanded.value = {}
}
function onAddRoot() {
  addModal.value = { parentId: null, name: '', error: false, enabled: true, inMenu: true }
}
function onAddSub() {
  addModal.value = { parentId: selectedId.value || null, name: '', error: false, enabled: true, inMenu: true, forceSub: true }
}
// tree is capped at 3 levels, so a depth-2 category takes no children
const addSubDisabled = computed(() => !!(selCat.value && categoryDepthOf(cats.value, selCat.value.id) >= 2))

// ── selected category ──
const selCat = computed(() => selectedId.value ? categoryById(cats.value, selectedId.value) : null)
const selectedPath = computed(() => selCat.value ? categoryPathById(cats.value, selCat.value.id) : '')

// ── scope ──
const scopeChoices = computed(() => [{ id: 'default', name: 'Default' }].concat(platforms.value.map(p => ({ id: p.id, name: p.name }))))
const scopeLabel = computed(() => (scopeChoices.value.find(c => c.id === scope.value) || scopeChoices.value[0])?.name || 'Default')
function scopeOptStyle(sel: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${sel ? '#ecfdf5' : 'transparent'};padding:8px 10px;font-size:14px;color:${sel ? '#047857' : '#334155'};font-weight:${sel ? 600 : 400};cursor:pointer;`
}
function pickScope(id: string) {
  scope.value = id
  scopeOpen.value = false
  page.value = 1
}
const scopeBadgeLabel = computed(() => overridden.value ? 'Overridden' : 'Inherited')
const scopeBadgeStyle = computed(() =>
  'font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;' + (overridden.value ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;' : 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;')
)

// ── products table ──
const filteredList = computed(() => {
  const positionsMap = effectivePositions()
  const q = (search.value || '').trim().toLowerCase()
  const src = selectedId.value ? productsForCategory(selectedId.value) : []
  const list = src
    .filter(p => !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q))
    .map(p => ({ ...p, included: members.value.indexOf(p.id) !== -1, pos: positionsMap[p.id] }))
  list.sort((a, b) => {
    const ap = a.pos == null ? Infinity : a.pos
    const bp = b.pos == null ? Infinity : b.pos
    if (ap !== bp) return ap - bp
    if (a.included !== b.included) return a.included ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return list
})
const pageSize = 8
const totalPages = computed(() => Math.max(1, Math.ceil(filteredList.value.length / pageSize)))
const clampedPage = computed(() => Math.min(page.value, totalPages.value))
const startIdx = computed(() => (clampedPage.value - 1) * pageSize)
const paged = computed(() => filteredList.value.slice(startIdx.value, startIdx.value + pageSize))
function goPage(p: number) {
  page.value = Math.min(Math.max(1, p), totalPages.value)
}
const countLabel = computed(() => members.value.length + ' of ' + filteredList.value.length + ' selected')
const rangeLabel = computed(() =>
  (filteredList.value.length === 0 ? 0 : startIdx.value + 1) + '–' + (startIdx.value + paged.value.length) + ' of ' + filteredList.value.length
)

function statusChipStyle(status: string) {
  return 'display:inline-block;font-size:11.5px;font-weight:700;padding:2px 10px;border-radius:999px;' + (status === 'Active' ? 'background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;' : 'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0;')
}
// Included rows get a faint green wash; UTable applies it per row via table meta.
const productTableMeta = {
  class: {
    tr: (row: { original: CatalogRow }) => row.original.included ? 'bg-[#fbfefc]' : ''
  }
}

const productColumns: TableColumn<CatalogRow>[] = [
  { id: 'select', header: '', meta: { class: { th: 'w-[46px] px-3.5 py-[11px]', td: 'px-3.5' } } },
  { accessorKey: 'displayId', header: 'ID', meta: { class: { th: 'w-[70px]' } } },
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'sku', header: 'SKU' },
  { accessorKey: 'status', header: 'Status', meta: { class: { th: 'w-24' } } },
  { accessorKey: 'price', header: 'Price', meta: { class: { th: 'w-24' } } },
  { id: 'pos', header: 'Position', meta: { class: { th: 'px-3.5 w-[104px]', td: 'px-3.5' } } }
]

function checkboxStyleOf() {
  return 'width:16px;height:16px;accent-color:#2b7fff;cursor:' + (isPlatformScope.value ? 'not-allowed' : 'pointer') + ';' + (isPlatformScope.value ? 'opacity:0.5;' : '')
}
function positionStyleOf() {
  const locked = posLocked.value
  return 'width:72px;border:1px solid #e2e8f0;border-radius:8px;padding:7px 8px;font-size:14px;color:#0f172a;background:' + (locked ? '#f1f5f9' : '#fff') + ';outline:none;text-align:center;' + (locked ? 'cursor:not-allowed;color:#94a3b8;' : '')
}
function priceLabelOf(price: number | null) {
  return price == null ? '—' : '¥' + Math.round(price).toLocaleString('en-US')
}

// ── delete modal derived ──
const kidCount = computed(() => selCat.value ? categoryChildren(cats.value, selCat.value.id).length : 0)
const deleteIcon = computed(() => blockedDelete.value ? 'shield-alert' : 'trash-2')
const deleteIconWrapStyle = computed(() =>
  'width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:' + (blockedDelete.value ? '#fffbeb' : '#fef2f2') + ';color:' + (blockedDelete.value ? '#d97706' : '#dc2626') + ';'
)
const deleteTitle = computed(() => blockedDelete.value ? 'Cannot delete category' : 'Delete ' + (selCat.value ? selCat.value.name : '') + '?')
const deleteMessage = computed(() => {
  if (!blockedDelete.value) return 'This action cannot be undone.'
  const k = kidCount.value
  const mlen = members.value.length
  const subWord = (k === 1 ? 'y' : 'ies')
  const prodWord = (mlen === 1 ? '' : 's')
  if (k > 0 && mlen > 0) return `This category has ${k} subcategor${subWord} and ${mlen} assigned product${prodWord}. Move or remove them first.`
  if (k > 0) return `This category has ${k} subcategor${subWord}. Move or delete them first.`
  return `This category has ${mlen} assigned product${prodWord}. Unassign them first.`
})
const deleteCancelLabel = computed(() => blockedDelete.value ? 'Close' : 'Cancel')

// ── add modal derived ──
const addTitle = computed(() => addModal.value ? (addModal.value.forceSub || addModal.value.parentId ? 'Add Subcategory' : 'Add Category') : '')
const parentOptions = computed(() => categoryTopLevel(cats.value).map(c => ({ id: c.id, name: c.name })))
function onReset() {
  if (selectedId.value) {
    select(selectedId.value)
    showToast('Changes reset')
  }
}
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Configuration' },
        { label: 'Categories' }
      ]"
    />

    <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 mt-0 mb-1">
          Categories
        </h1>
        <p class="text-[15px] text-slate-500 m-0">
          One shared category tree. Product order can be set per platform.
        </p>
      </div>
    </div>

    <!-- Default-scope explainer (dismissable) -->
    <div
      v-if="!isPlatformScope && !scopeInfoDismissed"
      class="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-[10px] px-3.5 py-3 mb-5"
    >
      <UIcon name="i-lucide-triangle-alert" class="w-[17px] h-[17px] text-amber-600 flex-shrink-0 mt-px" />
      <div class="flex-1 min-w-0 text-[13px] text-amber-800 leading-[1.5]">
        You're editing <strong>Default</strong>. Changes to structure, names, and membership apply to all platforms. To set position per platform, switch "Select platform" first.
      </div>
      <UButton
        variant="ghost"

        title="Dismiss"

        :ui="{ base: 'border-none bg-transparent text-amber-600 cursor-pointer p-0.5 inline-flex items-center flex-shrink-0' }"
        @click="scopeInfoDismissed = true"
      >
        <UIcon name="i-lucide-x" class="w-4 h-4" />
      </UButton>
    </div>

    <!-- scope card -->
    <UCard v-if="selCat" class="mb-5 px-[22px] py-5">
      <div class="flex items-center gap-2 mb-3.5">
        <UIcon name="i-lucide-layers" class="w-4 h-4 text-green-600" />
        <span class="text-[15px] font-bold text-slate-900">Select platform</span>
      </div>
      <div class="relative mb-3">
        <button type="button" :style="ddTrigger(scopeOpen)" @click="scopeOpen = !scopeOpen">
          <span class="whitespace-nowrap overflow-hidden text-ellipsis">{{ scopeLabel }}</span>
          <span :style="ddChevron(scopeOpen)"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
        </button>
        <template v-if="scopeOpen">
          <div class="fixed inset-0 z-40" @click="scopeOpen = false" />
          <div class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1 max-h-[250px] overflow-y-auto">
            <button
              v-for="opt in scopeChoices"
              :key="opt.id"
              type="button"
              :style="scopeOptStyle(opt.id === scope)"
              @click="pickScope(opt.id)"
            >
              <span>{{ opt.name }}</span>
              <UIcon v-if="opt.id === scope" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
            </button>
          </div>
        </template>
      </div>
      <div v-if="isPlatformScope" class="flex items-center gap-2.5 flex-wrap">
        <span :style="scopeBadgeStyle">{{ scopeBadgeLabel }}</span>
        <label class="inline-flex items-center gap-1.5 text-[13px] text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            :checked="!overridden"
            class="w-[15px] h-[15px] cursor-pointer accent-green-500"
            @change="onToggleUseDefaultOrder"
          >
          Use Default order
        </label>
      </div>
      <span v-else class="text-[13px] text-slate-500 leading-normal">Base order and membership for all platforms.</span>
    </UCard>

    <div class="flex flex-wrap gap-6 items-start">
      <!-- LEFT: collapsed rail -->
      <UCard v-if="treeCollapsed" class="basis-[60px] grow-0 shrink-0 w-[60px] overflow-hidden">
        <div class="py-3 flex justify-center border-b border-slate-100">
          <UButton
            variant="ghost"

            title="Show categories"

            :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-green-600 w-[34px] h-[34px] rounded-lg cursor-pointer inline-flex items-center justify-center' }"
            @click="treeCollapsed = false"
          >
            <UIcon name="i-lucide-panel-left-open" class="w-[17px] h-[17px]" />
          </UButton>
        </div>
        <div class="px-1.5 py-2 max-h-[560px] overflow-y-auto flex flex-col gap-[3px]">
          <button
            v-for="n in visibleRows"
            :key="n.id"
            :title="n.name + ' (' + productCount(n.id) + ')'"
            :style="railStyle(n.id)"
            @click="select(n.id)"
          >
            <UIcon :name="'i-lucide-' + treeIcon(n.childCount, n.id)" class="w-4 h-4 flex-shrink-0" />
          </button>
        </div>
      </UCard>

      <!-- LEFT: expanded tree -->
      <UCard v-else class="basis-[300px] grow-0 shrink-0 max-w-[300px] min-w-[260px] overflow-hidden">
        <div class="px-[18px] py-4 border-b border-slate-100">
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-xs font-bold text-slate-400 uppercase tracking-[0.04em]">Category tree</span>
            <UButton
              variant="ghost"

              title="Hide categories"

              :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-slate-500 w-[30px] h-[30px] rounded-lg cursor-pointer inline-flex items-center justify-center flex-shrink-0' }"
              @click="treeCollapsed = true"
            >
              <UIcon name="i-lucide-panel-left-close" class="w-4 h-4" />
            </UButton>
          </div>
          <!-- structural edits only apply to the Default scope -->
          <div v-if="!isPlatformScope" class="flex flex-col gap-2 mb-3">
            <UButton
              variant="ghost"

              :ui="{ base: 'w-full border-none bg-green-500 text-white text-sm font-bold px-3.5 py-2.5 rounded-lg cursor-pointer inline-flex items-center justify-center gap-[7px] hover:bg-green-600 transition-colors' }"
              @click="onAddRoot"
            >
              <UIcon name="i-lucide-plus" class="w-[15px] h-[15px]" /> Add Category
            </UButton>
            <UButton
              variant="ghost"

              :disabled="addSubDisabled"
              :ui="{ base: ['w-full border border-slate-200 bg-white text-sm font-semibold px-3.5 py-2.5 rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap', selectedId ? 'text-slate-700 cursor-pointer hover:bg-slate-50' : 'text-slate-300 cursor-not-allowed'] }"
              @click="onAddSub"
            >
              <UIcon name="i-lucide-corner-down-right" class="w-[15px] h-[15px]" /> Add Subcategory
            </UButton>
          </div>
          <div class="flex gap-3.5">
            <UButton
              variant="ghost"
              :ui="{ base: 'border-none bg-transparent text-green-600 text-[12.5px] font-semibold cursor-pointer p-0' }"
              @click="onExpandAll"
            >
              Expand All
            </UButton>
            <UButton
              variant="ghost"
              :ui="{ base: 'border-none bg-transparent text-slate-500 text-[12.5px] font-semibold cursor-pointer p-0' }"
              @click="onCollapseAll"
            >
              Collapse All
            </UButton>
          </div>
        </div>
        <div class="p-2 max-h-[560px] overflow-y-auto">
          <div
            v-for="n in visibleRows"
            :key="n.id"
            class="tree-row"
            :style="treeRowStyle(n.id, n.depth)"
            @click="select(n.id)"
          >
            <UButton
              v-if="n.childCount > 0"

              variant="ghost"

              :ui="{ base: 'border-none bg-transparent cursor-pointer p-0.5 inline-flex items-center text-slate-400 flex-shrink-0' }"
              @click.stop="toggleExpand(n.id)"
            >
              <UIcon :name="expanded[n.id] ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="w-3.5 h-3.5" />
            </UButton>
            <span v-else class="w-[18px] flex-shrink-0" />
            <UIcon :name="'i-lucide-' + treeIcon(n.childCount, n.id)" class="w-[15px] h-[15px] flex-shrink-0 text-slate-400" />
            <span :style="treeLabelStyle(n.id)">{{ n.name }}</span>
            <span
              v-if="!n.enabled"
              class="text-[10.5px] font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-[7px] py-px flex-shrink-0"
            >Off</span>
            <span :style="treeCountStyle(n.id)">{{ productCount(n.id) }}</span>
          </div>
        </div>
      </UCard>

      <!-- RIGHT -->
      <div class="grow-[999] shrink basis-[520px] min-w-0 flex flex-col gap-5">
        <template v-if="selCat">
          <!-- category editor -->
          <UCard class="p-6">
            <div class="flex items-start justify-between gap-3 mb-5">
              <div class="min-w-0">
                <h2 class="text-[17px] font-bold text-slate-900 mt-0 mb-1">
                  {{ selectedPath }}
                </h2>
                <p class="text-[13px] text-slate-500 m-0">
                  Category ID: {{ selCat.id }}
                </p>
              </div>
              <UButton
                variant="ghost"

                :ui="{ base: 'hover:bg-slate-100 flex-shrink-0 inline-flex items-center gap-1.5 border border-slate-200 bg-white text-red-600 text-[13.5px] font-semibold px-3.5 py-2 rounded-lg cursor-pointer' }"
                @click="deleteOpen = true"
              >
                <UIcon name="i-lucide-trash-2" class="w-3.5 h-3.5" /> Delete
              </UButton>
            </div>

            <VertexField
              label="Category Name"
              required
              :error="nameError ? 'Category name is required.' : ''"
              class="mb-[18px]"
            >
              <UInput
                :model-value="draftName"
                placeholder="e.g. Tourist SIM"
                @update:model-value="draftName = String($event); nameError = false"
              />
            </VertexField>

            <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Enable Category
                </div>
                <div class="text-[13px] text-slate-500 mt-0.5">
                  {{ draftEnabled ? 'Visible on the storefront' : 'Hidden from the storefront' }}
                </div>
              </div>
              <USwitch v-model="draftEnabled" class="shrink-0" />
            </div>
          </UCard>

          <!-- products in category -->
          <UCard class="p-6">
            <h2 class="text-[17px] font-bold text-slate-900 mt-0 mb-1">
              Products in Category
            </h2>
            <p class="text-[13px] text-slate-500 mt-0 mb-[18px]">
              Tick a product to include it, then set its position on the storefront category page.
            </p>

            <div class="flex items-center gap-3 mb-3.5 flex-wrap">
              <div class="relative flex-1 min-w-[220px] max-w-[360px]">
                <UIcon name="i-lucide-search" class="w-[15px] h-[15px] text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  :value="search"
                  placeholder="Search by name or SKU..."
                  class="w-full border border-slate-200 rounded-lg py-[9px] pr-3 pl-[34px] text-sm text-slate-900 outline-none focus:border-green-500"
                  @input="search = ($event.target as HTMLInputElement).value; page = 1"
                >
              </div>
              <span class="text-[13.5px] text-slate-500">{{ countLabel }}</span>
            </div>

            <div class="border border-slate-200 rounded-[10px] overflow-hidden">
              <div class="overflow-x-auto">
                <UTable
                  :data="paged"
                  :columns="productColumns"
                  :meta="productTableMeta"
                  :empty="'No products match your search.'"
                  :ui="{
                    ...tableUi('min-w-[700px]'),
                    th: 'th text-left text-xs px-2.5 py-[11px]',
                    td: 'px-2.5 py-[11px]',
                    empty: 'px-5 py-10 text-center text-sm text-slate-400'
                  }"
                >
                  <template #select-cell="{ row }">
                    <input
                      type="checkbox"
                      :checked="row.original.included"
                      :disabled="isPlatformScope"
                      :style="checkboxStyleOf()"
                      @change="toggleMember(row.original.id)"
                    >
                  </template>

                  <template #displayId-cell="{ row }">
                    <span class="text-[13px] text-slate-500">{{ row.original.displayId }}</span>
                  </template>

                  <template #name-cell="{ row }">
                    <span class="text-sm font-semibold text-slate-900">{{ row.original.name }}</span>
                  </template>

                  <template #sku-cell="{ row }">
                    <span class="text-[13px] text-slate-500">{{ row.original.sku }}</span>
                  </template>

                  <template #status-cell="{ row }">
                    <span :style="statusChipStyle(row.original.status)">{{ row.original.status }}</span>
                  </template>

                  <template #price-cell="{ row }">
                    <span class="text-sm text-slate-700">{{ priceLabelOf(row.original.price) }}</span>
                  </template>

                  <template #pos-cell="{ row }">
                    <input
                      type="number"
                      min="1"
                      :value="row.original.pos == null ? '' : row.original.pos"
                      :disabled="posLocked"
                      placeholder="—"
                      :style="positionStyleOf()"
                      @change="setPosition(row.original.id, ($event.target as HTMLInputElement).value)"
                    >
                  </template>
                </UTable>
              </div>
            </div>

            <VertexPagination
              v-if="totalPages > 1"
              :page="clampedPage"
              :total-pages="totalPages"
              :label="rangeLabel"
              size="sm"
              class="mt-3.5"
              @update:page="goPage"
            />

            <div class="flex justify-end gap-2.5 mt-5 pt-[18px] border-t border-slate-100">
              <UButton
                variant="ghost"

                :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer inline-flex items-center gap-1.5 hover:bg-slate-50 transition-colors' }"
                @click="onReset"
              >
                <UIcon name="i-lucide-rotate-ccw" class="w-[15px] h-[15px]" /> Reset
              </UButton>
              <UButton
                variant="ghost"

                :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[22px] py-2.5 rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors' }"
                @click="save"
              >
                Save Category
              </UButton>
            </div>
          </UCard>
        </template>

        <VertexEmptyState
          v-else
          icon="folder-tree"
          title="Select a category"
          hint="Pick a category from the tree to edit its details and product order."
          class="bg-white border border-slate-200 rounded-xl shadow-sm"
        />
      </div>
    </div>

    <!-- delete modal -->
    <div
      v-if="deleteOpen"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[200] p-5"
    >
      <div class="bg-white rounded-[14px] w-[460px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6">
        <div class="flex items-center gap-3 mb-2">
          <div :style="deleteIconWrapStyle">
            <UIcon :name="'i-lucide-' + deleteIcon" class="w-[22px] h-[22px]" />
          </div>
          <h3 class="text-[17px] font-bold text-slate-900 m-0">
            {{ deleteTitle }}
          </h3>
        </div>
        <p class="text-[15px] text-slate-500 mt-0 mb-5 leading-normal">
          {{ deleteMessage }}
        </p>
        <div class="flex justify-end gap-2.5">
          <UButton
            variant="ghost"

            :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer' }"
            @click="deleteOpen = false"
          >
            {{ deleteCancelLabel }}
          </UButton>
          <UButton
            v-if="!blockedDelete"

            variant="ghost"

            :ui="{ base: 'border-none bg-red-600 text-white text-[15px] font-bold px-[18px] py-[9px] rounded-lg cursor-pointer' }"
            @click="confirmDelete"
          >
            Delete
          </UButton>
        </div>
      </div>
    </div>

    <!-- add modal -->
    <div
      v-if="addModal"
      class="fixed inset-0 bg-slate-900/45 backdrop-blur-[2px] flex items-center justify-center z-[210] p-5"
    >
      <div class="bg-white rounded-[14px] w-[460px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        <UForm :schema="addSchema" :state="addModal" @submit="onAddSubmit">
          <div class="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <h3 class="text-[17px] font-bold text-slate-900 m-0">
              {{ addTitle }}
            </h3>
            <UButton
              variant="ghost"

              :ui="{ base: 'hover:bg-slate-100 border-none bg-transparent text-slate-500 w-8 h-8 rounded-lg cursor-pointer flex items-center justify-center' }"
              @click="addModal = null"
            >
              <UIcon name="i-lucide-x" class="w-[18px] h-[18px]" />
            </UButton>
          </div>
          <div class="p-6">
            <div v-if="addModal.forceSub" class="mb-[18px]">
              <label class="field-label">Parent Category</label>
              <div class="select-wrap">
                <USelect
                  :model-value="addModal.parentId || undefined"
                  :items="parentOptions"
                  value-key="id"
                  label-key="name"
                  placeholder="Select parent…"
                  @update:model-value="addModal.parentId = $event || null"
                />
              </div>
            </div>
            <UFormField
              name="name"
              label="Category Name"
              required
              class="mb-[18px] pb-[18px] border-b border-slate-100"
            >
              <UInput v-model="addModal.name" placeholder="e.g. Resident SIM" />
            </UFormField>

            <div class="flex items-center justify-between gap-3 mb-4">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Enable Category
                </div>
                <div class="text-[12.5px] text-slate-400 mt-0.5">
                  {{ addModal.enabled ? 'Visible on the storefront' : 'Hidden from the storefront' }}
                </div>
              </div>
              <div class="flex items-center gap-[9px] flex-shrink-0">
                <USwitch v-model="addModal.enabled" class="shrink-0" />
                <span class="text-[13.5px] font-semibold text-slate-700 w-[26px]">{{ addModal.enabled ? 'Yes' : 'No' }}</span>
              </div>
            </div>

            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Include in Menu
                </div>
                <div class="text-[12.5px] text-slate-400 mt-0.5">
                  {{ addModal.inMenu ? 'Shown in storefront navigation' : 'Not shown in navigation' }}
                </div>
              </div>
              <div class="flex items-center gap-[9px] flex-shrink-0">
                <USwitch v-model="addModal.inMenu" class="shrink-0" />
                <span class="text-[13.5px] font-semibold text-slate-700 w-[26px]">{{ addModal.inMenu ? 'Yes' : 'No' }}</span>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2.5 px-6 py-4 border-t border-slate-100">
            <UButton
              variant="ghost"

              :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-[18px] py-[9px] rounded-lg cursor-pointer' }"
              @click="addModal = null"
            >
              Cancel
            </UButton>
            <UButton
              type="submit"
              variant="ghost"
              :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-5 py-[9px] rounded-lg cursor-pointer' }"
            >
              Create
            </UButton>
          </div>
        </UForm>
      </div>
    </div>

    <!-- toast -->
    <VertexToast :message="toast" />
  </div>
</template>
