<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { ConfigValues, Platform } from '~/types'

useHead({ title: 'Edit Platform — Vertex' })

const route = useRoute()
const router = useRouter()

// ── platform + identity ──
const platforms = ref<Platform[]>([])
const loading = ref(true)

const platform = computed<Platform | null>(() => {
  const id = typeof route.query.id === 'string' ? route.query.id : ''
  return (id ? platformById(platforms.value, id) : null) || platforms.value[0] || null
})

const identity = reactive({ name: '', code: '', url: '' })
const cfg = ref<ConfigValues>({})
const schema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  url: z.string().trim().min(1, 'URL / Path is required.')
})
type Schema = { name: string, url: string }
const dirty = ref(false)
const saveError = ref('')
const discardOpen = ref(false)

// Seed identity + config from whatever platform the route resolves to.
/** Identity fields come from the already-loaded list; config is a separate read. */
function hydrateIdentity() {
  const p = platform.value
  identity.name = p ? p.name : ''
  identity.code = p ? p.code : ''
  identity.url = p ? p.url : ''
}

hydrateIdentity()

onMounted(async () => {
  try {
    platforms.value = await loadPlatforms()
    hydrateIdentity()
    const p = platform.value
    cfg.value = p ? await loadPlatformConfig(p.id) : { ...GENERIC_CONFIG_SEED }
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Could not load this platform.')
  } finally {
    loading.value = false
  }
  dirty.value = false
})

// keeps the dirty flag the inline setCfg used to set
function onCfgUpdate(next: ConfigValues) {
  cfg.value = next
  dirty.value = true
}
function setIdentity(field: 'name' | 'url', value: string) {
  identity[field] = value
  dirty.value = true
}

// ── save ──
const saving = ref(false)

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  const p = platform.value
  if (saving.value) return
  if (p) {
    saving.value = true
    try {
      await apiUpdate<Platform>('platforms', p.id, { name: identity.name.trim(), url: identity.url.trim() })
      await savePlatformConfig(p.id, { ...cfg.value, baseUrl: identity.url.trim() })
    } catch (err) {
      saving.value = false
      saveError.value = apiErrorMessage(err, 'Could not save the platform.')
      return
    }
    saving.value = false
  }
  try {
    sessionStorage.setItem('vertex_platform_toast', identity.name.trim() + ' updated')
  } catch {
    // sessionStorage unavailable
  }
  dirty.value = false
  return router.push('/platforms')
}

// ── leave guard ──
function tryLeave() {
  if (dirty.value) {
    discardOpen.value = true
    return
  }
  return router.push('/platforms')
}

const pageTitle = computed(() => 'Edit Platform — ' + (platform.value ? platform.value.name : 'Platform'))
const crumbLast = computed(() => platform.value ? platform.value.name : 'Platform')
</script>

<template>
  <div class="flex-1 min-w-0 px-8 pt-7 pb-20">
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Platforms', to: '/platforms' },
        { label: crumbLast }
      ]"
    />

    <div class="flex items-center gap-3 mb-2">
      <UButton
        variant="ghost"

        title="Back to platforms"

        :ui="{ base: 'hover:bg-slate-100 w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 cursor-pointer' }"
        @click="tryLeave"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </UButton>
      <h1 class="text-2xl font-bold text-slate-900 m-0">
        {{ pageTitle }}
      </h1>
    </div>
    <p class="text-[15px] text-slate-500 mt-0 mb-6 pl-[50px]">
      Identity and configuration for this platform. Each platform holds its own values.
    </p>

    <!-- IDENTITY -->
    <VertexLoadingPanel v-if="loading" label="Loading platform…" />

    <UForm
      v-else
      :schema="schema"
      :state="identity"
      @submit="onSubmit"
    >
      <UCard class="mb-4 p-6">
        <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
          Platform Information
        </h2>
        <p class="text-[13px] text-slate-500 mt-0 mb-5">
          Identity for this sales channel.
        </p>

        <UFormField
          name="name"
          label="Name"
          required
          class="mb-[18px]"
        >
          <UInput
            :model-value="identity.name"
            placeholder="e.g. SIM Point"
            @update:model-value="setIdentity('name', String($event))"
          />
        </UFormField>

        <UFormField
          name="code"
          label="Code"
          required
          help="Locked — the code can't change after creation."
          class="mb-[18px]"
        >
          <UInput
            :model-value="identity.code"
            disabled
            placeholder="e.g. sim_point"
            :ui="fieldUi('font-mono')"
          />
        </UFormField>

        <UFormField name="url" label="URL / Path" required>
          <UInput
            :model-value="identity.url"
            placeholder="e.g. vdm.com/sp-sim"
            @update:model-value="setIdentity('url', String($event))"
          />
        </UFormField>
      </UCard>

      <VertexPlatformConfigGroups
        :model-value="cfg"
        :synced-url="identity.url"
        @update:model-value="onCfgUpdate"
      />

      <div class="flex justify-end gap-2.5 mt-5">
        <UButton
          variant="ghost"

          :ui="{ base: 'border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors' }"
          @click="tryLeave"
        >
          Cancel
        </UButton>
        <UButton
          type="submit"
          variant="ghost"
          :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[22px] py-2.5 rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors' }"
        >
          Save Platform
        </UButton>

        <div
          v-if="saveError"
          class="basis-full flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-[13px] text-red-700"
        >
          <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
          <span>{{ saveError }}</span>
        </div>
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
      @confirm="router.push('/platforms')"
    />
  </div>
</template>
