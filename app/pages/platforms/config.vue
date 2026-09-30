<script setup lang="ts">
import type { ConfigValues, Platform } from '~/types'

useHead({ title: 'Edit Platform — Vertex' })

const route = useRoute()
const router = useRouter()

// ── platform + identity ──
const platforms = ref<Platform[]>(PLATFORM_SEED)

const platform = computed<Platform | null>(() => {
  const id = typeof route.query.id === 'string' ? route.query.id : ''
  return (id ? platformById(platforms.value, id) : null) || platforms.value[0] || null
})

const identity = reactive({ name: '', code: '', url: '' })
const cfg = ref<ConfigValues>({})
const errors = reactive<{ name: string, url: string }>({ name: '', url: '' })
const dirty = ref(false)
const discardOpen = ref(false)

// Seed identity + config from whatever platform the route resolves to.
function hydrate() {
  const p = platform.value
  identity.name = p ? p.name : ''
  identity.code = p ? p.code : ''
  identity.url = p ? p.url : ''
  cfg.value = p ? loadPlatformConfig(p.id) : { ...GENERIC_CONFIG_SEED }
}

hydrate()

onMounted(() => {
  platforms.value = loadPlatforms()
  hydrate()
  dirty.value = false
})

// keeps the dirty flag the inline setCfg used to set
function onCfgUpdate(next: ConfigValues) {
  cfg.value = next
  dirty.value = true
}
function setIdentity(field: 'name' | 'url', value: string) {
  identity[field] = value
  errors[field] = ''
  dirty.value = true
}

// ── save ──
function save() {
  errors.name = identity.name.trim() ? '' : 'Name is required.'
  errors.url = identity.url.trim() ? '' : 'URL / Path is required.'
  if (errors.name || errors.url) return

  const p = platform.value
  if (p) {
    savePlatforms(loadPlatforms().map(x => x.id === p.id
      ? { ...x, name: identity.name.trim(), url: identity.url.trim() }
      : x))
    savePlatformConfig(p.id, { ...cfg.value, baseUrl: identity.url.trim() })
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

        :ui="{ base: 'btn-icon-hover w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0 cursor-pointer' }"
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
    <UCard class="mb-4 p-6">
      <h2 class="text-base font-bold text-slate-900 mt-0 mb-1">
        Platform Information
      </h2>
      <p class="text-[13px] text-slate-500 mt-0 mb-5">
        Identity for this sales channel.
      </p>

      <VertexField
        label="Name"
        required
        :error="errors.name"
        class="mb-[18px]"
      >
        <input
          :value="identity.name"
          type="text"
          class="field-input"
          :class="errors.name ? 'err' : ''"
          placeholder="e.g. SIM Point"
          @input="setIdentity('name', ($event.target as HTMLInputElement).value)"
        >
      </VertexField>

      <VertexField
        label="Code"
        required
        hint="Locked — the code can't change after creation."
        class="mb-[18px]"
      >
        <input
          :value="identity.code"
          type="text"
          disabled
          class="field-input font-mono"
          placeholder="e.g. sim_point"
        >
      </VertexField>

      <VertexField label="URL / Path" required :error="errors.url">
        <input
          :value="identity.url"
          type="text"
          class="field-input"
          :class="errors.url ? 'err' : ''"
          placeholder="e.g. vdm.com/sp-sim"
          @input="setIdentity('url', ($event.target as HTMLInputElement).value)"
        >
      </VertexField>
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
        variant="ghost"

        :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[22px] py-2.5 rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors' }"
        @click="save"
      >
        Save Platform
      </UButton>
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
      @confirm="router.push('/platforms')"
    />
  </div>
</template>
