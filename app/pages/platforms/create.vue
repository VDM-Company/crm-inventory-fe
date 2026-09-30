<script setup lang="ts">
import type { ConfigValues, Platform } from '~/types'

useHead({ title: 'Create Platform — Vertex' })

const route = useRoute()
const router = useRouter()

interface FormErrors { name?: string, code?: string, url?: string }

// ── state (mirrors the design's DCLogic state) ──
const editId = ref<string | null>(null)
const form = reactive({ name: '', code: '', url: '' })
const codeTouched = ref(false)
const dirty = ref(false)
const errors = ref<FormErrors>({})
const discardOpen = ref(false)
// Config starts blank on this screen (the design does not preload an existing
// platform's saved values here) and is written on save.
const cfg = ref<ConfigValues>({ ...GENERIC_CONFIG_SEED })

// SSR-safe: resolve the edit target from localStorage only after mount, so
// server + first client paint both render the empty "Create" form.
onMounted(() => {
  const rawId = route.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (id) {
    const existing = platformById(loadPlatforms(), id)
    if (existing) {
      editId.value = id
      form.name = existing.name
      form.code = existing.code
      form.url = existing.url
      codeTouched.value = true
    }
  }
})

const pageTitle = computed(() => editId.value ? 'Edit Platform' : 'Create Platform')
const codeLocked = computed(() => !!editId.value)

// keeps the dirty flag the inline setCfg used to set
function onCfgUpdate(next: ConfigValues) {
  cfg.value = next
  dirty.value = true
}
function set(field: 'name' | 'code' | 'url', value: string) {
  form[field] = value
  errors.value = { ...errors.value, [field]: undefined }
  if (field === 'name' && !codeTouched.value && !editId.value) {
    form.code = platformSlug(value)
  }
  dirty.value = true
}
function onCodeModel(value: string) {
  codeTouched.value = true
  set('code', platformSlug(value))
}

const saveDisabled = computed(() => !(form.name.trim() && form.code.trim() && form.url.trim()))

function validate(): FormErrors {
  const f = form
  const errs: FormErrors = {}
  if (!f.name || !f.name.trim()) errs.name = 'Name is required.'
  if (!f.code || !f.code.trim()) {
    errs.code = 'Code is required.'
  } else {
    const dup = loadPlatforms().find(p => p.code === f.code.trim() && p.id !== editId.value)
    if (dup) errs.code = 'This code is already in use.'
  }
  if (!f.url || !f.url.trim()) errs.url = 'URL / Path is required.'
  return errs
}

function save() {
  const errs = validate()
  if (Object.keys(errs).length) {
    errors.value = errs
    return
  }
  const f = form
  const list = loadPlatforms()
  let next: Platform[]
  let savedId = editId.value
  if (editId.value) {
    next = list.map(p => p.id === editId.value ? { ...p, name: f.name.trim(), url: f.url.trim() } : p)
  } else {
    savedId = 'plat_' + Date.now()
    next = [...list, { id: savedId, name: f.name.trim(), code: f.code.trim(), url: f.url.trim() }]
  }
  savePlatforms(next)
  if (savedId) savePlatformConfig(savedId, { ...cfg.value, baseUrl: f.url.trim() })
  try {
    sessionStorage.setItem('vertex_platform_toast', editId.value ? 'Platform updated successfully' : 'Platform created successfully')
  } catch {
    // ignore
  }
  dirty.value = false
  router.push('/platforms')
}

function onLeave() {
  if (dirty.value) discardOpen.value = true
  else router.push('/platforms')
}
function onConfirmDiscard() {
  router.push('/platforms')
}
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Platforms', to: '/platforms' },
        { label: pageTitle }
      ]"
    />

    <div class="flex items-center gap-3 mb-6">
      <UButton
        variant="ghost"

        :ui="{ base: 'btn-icon-hover w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 cursor-pointer' }"
        @click="onLeave"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </UButton>
      <h1 class="text-2xl font-bold text-slate-900 m-0">
        {{ pageTitle }}
      </h1>
    </div>

    <div>
      <UCard class="p-6">
        <h2 class="text-[17px] font-bold text-slate-900 mt-0 mb-1">
          Platform Information
        </h2>
        <p class="text-sm text-slate-500 mt-0 mb-5">
          A sales channel under Vertex Digital Marketing.
        </p>

        <VertexField
          label="Name"
          required
          :error="errors.name"
          class="mb-[18px]"
        >
          <UInput
            :model-value="form.name"
            :ui="{ base: errors.name ? 'border-red-600' : '' }"
            placeholder="e.g. SIM Point"
            @update:model-value="set('name', String($event))"
          />
        </VertexField>

        <VertexField
          label="Code"
          required
          :error="errors.code"
          :hint="editId ? '' : 'Lowercase identifier, auto-filled from the name. Editable before saving; locked after creation.'"
          class="mb-[18px]"
        >
          <UInput
            :model-value="form.code"
            :disabled="codeLocked"
            :ui="{ base: ['font-mono', errors.code ? 'border-red-600' : ''] }"
            placeholder="e.g. sim_point"
            @update:model-value="onCodeModel(String($event))"
          />
        </VertexField>

        <VertexField label="URL / Path" required :error="errors.url">
          <UInput
            :model-value="form.url"
            :ui="{ base: errors.url ? 'border-red-600' : '' }"
            placeholder="e.g. vdm.com/sp-sim"
            @update:model-value="set('url', String($event))"
          />
        </VertexField>
      </UCard>

      <VertexPlatformConfigGroups
        :model-value="cfg"
        :synced-url="form.url"
        class="mt-4"
        @update:model-value="onCfgUpdate"
      />

      <div class="flex justify-end gap-2.5 mt-5">
        <UButton
          variant="ghost"

          :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer' }"
          @click="onLeave"
        >
          Cancel
        </UButton>
        <UButton
          variant="ghost"

          :disabled="saveDisabled"
          :ui="{ base: ['border-none text-[15px] font-bold px-[22px] py-2.5 rounded-lg', saveDisabled
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-green-500 text-white cursor-pointer shadow-sm hover:bg-green-600 transition-colors'] }"
          @click="save"
        >
          Save Platform
        </UButton>
      </div>
    </div>

    <!-- discard confirm -->
    <VertexConfirmModal
      :open="discardOpen"
      title="Discard changes?"
      message="Any information you entered will be lost."
      icon="triangle-alert"
      tone="warning"
      cancel-label="Keep editing"
      confirm-label="Discard"
      width-class="w-[420px]"
      @cancel="discardOpen = false"
      @confirm="onConfirmDiscard"
    />
  </div>
</template>
