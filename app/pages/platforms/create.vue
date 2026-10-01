<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ConfigValues, Platform } from '~/types'

useHead({ title: 'Create Platform — Vertex' })

const route = useRoute()
const router = useRouter()

// ── state (mirrors the design's DCLogic state) ──
const editId = ref<string | null>(null)
const form = reactive({ name: '', code: '', url: '' })
const codeTouched = ref(false)
const dirty = ref(false)
const saveError = ref('')
const allPlatforms = ref<Platform[]>([])
const discardOpen = ref(false)
// Config starts blank on this screen (the design does not preload an existing
// platform's saved values here) and is written on save.
const cfg = ref<ConfigValues>({ ...GENERIC_CONFIG_SEED })

// SSR-safe: resolve the edit target from localStorage only after mount, so
// server + first client paint both render the empty "Create" form.
onMounted(async () => {
  try {
    allPlatforms.value = await loadPlatforms()
  } catch {
    // leave the list empty; the duplicate-code check simply cannot run
  }
  const rawId = route.query.id
  const id = Array.isArray(rawId) ? rawId[0] : rawId
  if (id) {
    const existing = platformById(allPlatforms.value, id)
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
// Schema is a computed so the duplicate-code refinement sees the current store
// and the row being edited.
const schema = computed(() => z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  code: z.string()
    .trim()
    .min(1, 'Code is required.')
    .refine(
      v => !allPlatforms.value.some(p => p.code === v && p.id !== editId.value),
      'This code is already in use.'
    ),
  url: z.string().trim().min(1, 'URL / Path is required.')
}))
type Schema = { name: string, code: string, url: string }

function set(field: 'name' | 'code' | 'url', value: string) {
  form[field] = value
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

const saving = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  const f = event.data
  if (saving.value) return
  saving.value = true
  let savedId = editId.value
  try {
    if (editId.value) {
      await apiUpdate<Platform>('platforms', editId.value, { name: f.name.trim(), url: f.url.trim() })
    } else {
      const created = await apiCreate<Platform>('platforms', {
        name: f.name.trim(), code: f.code.trim(), url: f.url.trim()
      })
      savedId = created.id
    }
    if (savedId) await savePlatformConfig(savedId, { ...cfg.value, baseUrl: f.url.trim() })
  } catch (err) {
    saving.value = false
    saveError.value = apiErrorMessage(err, 'Could not save the platform.')
    return
  }
  saving.value = false
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

        :ui="{ base: 'hover:bg-slate-100 w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 cursor-pointer' }"
        @click="onLeave"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </UButton>
      <h1 class="text-2xl font-bold text-slate-900 m-0">
        {{ pageTitle }}
      </h1>
    </div>

    <UForm :schema="schema" :state="form" @submit="onSubmit">
      <UCard class="p-6">
        <h2 class="text-[17px] font-bold text-slate-900 mt-0 mb-1">
          Platform Information
        </h2>
        <p class="text-sm text-slate-500 mt-0 mb-5">
          A sales channel under Vertex Digital Marketing.
        </p>

        <UFormField
          name="name"
          label="Name"
          required
          class="mb-[18px]"
        >
          <UInput
            :model-value="form.name"
            placeholder="e.g. SIM Point"
            @update:model-value="set('name', String($event))"
          />
        </UFormField>

        <UFormField
          name="code"
          label="Code"
          required
          :help="editId ? undefined : 'Lowercase identifier, auto-filled from the name. Editable before saving; locked after creation.'"
          class="mb-[18px]"
        >
          <UInput
            :model-value="form.code"
            :disabled="codeLocked"
            :ui="{ base: 'font-mono' }"
            placeholder="e.g. sim_point"
            @update:model-value="onCodeModel(String($event))"
          />
        </UFormField>

        <UFormField name="url" label="URL / Path" required>
          <UInput
            :model-value="form.url"
            placeholder="e.g. vdm.com/sp-sim"
            @update:model-value="set('url', String($event))"
          />
        </UFormField>
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
          type="submit"
          variant="ghost"
          :disabled="saveDisabled || saving"
          :ui="{ base: ['border-none text-[15px] font-bold px-[22px] py-2.5 rounded-lg', saveDisabled
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
            : 'bg-green-500 text-white cursor-pointer shadow-sm hover:bg-green-600 transition-colors'] }"
        >
          Save Platform
        </UButton>
      </div>

      <div
        v-if="saveError"
        class="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-[13px] text-red-700"
      >
        <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
        <span>{{ saveError }}</span>
      </div>
    </UForm>

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
