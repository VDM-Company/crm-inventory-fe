<script setup lang="ts">
import type { AttributeDef } from '~/types'

const route = useRoute()

const INPUT_TYPES = ['Text', 'Select', 'Radio', 'Numeric', 'Checkbox']
// only these carry a predefined value list
const OPTION_TYPES = ['Select', 'Radio', 'Checkbox']

const editId = computed(() => {
  const raw = route.query.id
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && v ? v : null
})

// ── state ──
const attrs = ref<AttributeDef[]>([])
const name = ref('')
const type = ref('Select')
const required = ref(true)
const options = ref<string[]>([''])
const nameError = ref('')
const optionsError = ref('')

const pageTitle = computed(() => editId.value ? 'Edit Attribute' : 'Create Attribute')
useHead({ title: () => pageTitle.value + ' — Vertex' })

// SSR-safe: the store is read on mount (localStorage is client-only), then the
// edited attribute seeds the form.
onMounted(() => {
  attrs.value = loadAttributeDefs()
  if (!editId.value) return
  const existing = attrs.value.find(a => a.id === editId.value)
  if (!existing) return
  name.value = existing.name
  type.value = existing.type || 'Select'
  required.value = true
  options.value = (existing.values || []).slice()
})

const isOptionType = computed(() => OPTION_TYPES.indexOf(type.value) !== -1)
const freeTypeHint = computed(() =>
  type.value === 'Numeric' ? 'Numeric inputs have no predefined values.' : 'Text inputs have no predefined values.'
)

function onNameChange(e: Event) {
  name.value = (e.target as HTMLInputElement).value
  nameError.value = ''
}
function onTypeChange(e: Event) {
  type.value = (e.target as HTMLSelectElement).value
  optionsError.value = ''
}

// ── option rows ──
function setOption(i: number, v: string) {
  options.value = options.value.map((o, idx) => idx === i ? v : o)
  optionsError.value = ''
}
function addOption() {
  options.value = [...options.value, '']
}
function removeOption(i: number) {
  options.value = options.value.filter((_, idx) => idx !== i)
}
function moveOption(i: number, dir: number) {
  const arr = options.value.slice()
  const j = i + dir
  if (j < 0 || j >= arr.length) return
  const tmp = arr[i]!
  arr[i] = arr[j]!
  arr[j] = tmp
  options.value = arr
}
function arrowStyle(disabled: boolean) {
  return `border:1px solid #e2e8f0;background:#fff;color:${disabled ? '#cbd5e1' : '#64748b'};width:26px;height:19px;border-radius:6px;cursor:${disabled ? 'not-allowed' : 'pointer'};display:flex;align-items:center;justify-content:center;padding:0;`
}
const optionRows = computed(() =>
  options.value.map((o, i) => ({
    index: i,
    value: o,
    isFirst: i === 0,
    isLast: i === options.value.length - 1,
    upStyle: arrowStyle(i === 0),
    downStyle: arrowStyle(i === options.value.length - 1)
  }))
)

// ── required toggle ──
function toggleRequired() {
  required.value = !required.value
}
const requiredTrackStyle = computed(() =>
  `width:40px;height:22px;border-radius:999px;border:none;cursor:pointer;background:${required.value ? '#00c16a' : '#e2e8f0'};position:relative;padding:2px;display:inline-flex;align-items:center;transition:background 150ms ease;`
)
const requiredKnobStyle = computed(() =>
  `width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.15);transform:translateX(${required.value ? '18px' : '0px'});transition:transform 150ms ease;display:block;`
)

// ── live preview ──
const cleanedOptions = computed(() => options.value.map(o => (o || '').trim()).filter(Boolean))
const previewOptions = computed(() => cleanedOptions.value.length ? cleanedOptions.value : ['Option 1', 'Option 2'])
const previewLabel = computed(() => name.value || 'Attribute')
const previewPlaceholder = computed(() => 'Enter ' + (name.value || 'value').toLowerCase())

// ── save ──
function validateAndBuild(): { name: string, type: string, values: string[] } | null {
  const clean = name.value.trim()
  if (!clean) {
    nameError.value = 'Attribute name is required.'
    return null
  }
  if (attrs.value.some(a => a.name.toLowerCase() === clean.toLowerCase() && a.id !== editId.value)) {
    nameError.value = 'An attribute with this name already exists.'
    return null
  }
  if (isOptionType.value && required.value && cleanedOptions.value.length === 0) {
    optionsError.value = 'Add at least one value.'
    return null
  }
  return { name: clean, type: type.value, values: cleanedOptions.value }
}
function onSave() {
  const built = validateAndBuild()
  if (!built) return
  const next = editId.value
    ? attrs.value.map(a => a.id === editId.value ? { ...a, name: built.name, type: built.type, values: built.values } : a)
    : [...attrs.value, { id: 'attr_' + Date.now(), name: built.name, type: built.type, values: built.values }]
  saveAttributeDefs(next)
  return navigateTo('/attributes')
}
</script>

<template>
  <div class="flex-1 min-w-0 p-5">
    <VertexBreadcrumb
      :items="[
        { label: 'Inventory', to: '/dashboard' },
        { label: 'Product', to: '/dashboard' },
        { label: 'Configuration' },
        { label: 'Attributes', to: '/attributes' },
        { label: pageTitle }
      ]"
    />

    <div class="flex items-center gap-3 mb-6">
      <NuxtLink
        to="/attributes"
        class="btn-icon-hover w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </NuxtLink>
      <h1 class="text-2xl font-bold text-slate-900 m-0">
        {{ pageTitle }}
      </h1>
    </div>

    <div class="flex gap-6 items-start flex-wrap">
      <!-- config -->
      <div class="grow shrink basis-[420px] min-w-0 flex flex-col gap-6">
        <UCard class="p-6">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-5">
            Attribute Details
          </h2>

          <VertexField
            label="Attribute Name"
            required
            :error="nameError"
            class="mb-[18px]"
          >
            <input
              class="field-input"
              type="text"
              :value="name"
              placeholder="e.g. Duration"
              @input="onNameChange"
            >
          </VertexField>

          <VertexField label="Input Type" required class="mb-[18px]">
            <select class="field-input" :value="type" @change="onTypeChange">
              <option v-for="t in INPUT_TYPES" :key="t" :value="t">
                {{ t }}
              </option>
            </select>
          </VertexField>

          <template v-if="isOptionType">
            <div class="flex items-center justify-between gap-3 py-3 border-t border-slate-100">
              <div>
                <div class="text-sm font-semibold text-slate-900">
                  Values required
                </div>
                <div class="text-[13px] text-slate-500 mt-0.5">
                  Require at least one value to save.
                </div>
              </div>
              <button :style="requiredTrackStyle" @click="toggleRequired">
                <span :style="requiredKnobStyle" />
              </button>
            </div>

            <div class="mt-2">
              <label class="field-label">Manage Options</label>
              <div class="flex flex-col gap-2">
                <div v-for="o in optionRows" :key="o.index" class="flex items-center gap-2">
                  <div class="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      :disabled="o.isFirst"
                      title="Move up"
                      class="btn-icon-hover"
                      :style="o.upStyle"
                      @click="moveOption(o.index, -1)"
                    >
                      <UIcon name="i-lucide-chevron-up" class="w-[13px] h-[13px]" />
                    </button>
                    <button
                      :disabled="o.isLast"
                      title="Move down"
                      class="btn-icon-hover"
                      :style="o.downStyle"
                      @click="moveOption(o.index, 1)"
                    >
                      <UIcon name="i-lucide-chevron-down" class="w-[13px] h-[13px]" />
                    </button>
                  </div>
                  <input
                    class="field-input flex-1"
                    type="text"
                    :value="o.value"
                    placeholder="Option value"
                    @input="setOption(o.index, ($event.target as HTMLInputElement).value)"
                  >
                  <UButton
                    variant="ghost"

                    title="Delete option"

                    :ui="{ base: 'btn-icon-hover border border-slate-200 bg-white text-red-600 w-10 h-10 rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0' }"
                    @click="removeOption(o.index)"
                  >
                    <UIcon name="i-lucide-trash-2" class="w-[15px] h-[15px]" />
                  </UButton>
                </div>
              </div>
              <UButton
                variant="ghost"

                :ui="{ base: 'mt-2.5 inline-flex items-center gap-1.5 border border-dashed border-green-500 bg-emerald-50 text-green-600 text-[13px] font-semibold px-4 py-[9px] rounded-lg cursor-pointer' }"
                @click="addOption"
              >
                <UIcon name="i-lucide-plus" class="w-3.5 h-3.5" /> Add Option
              </UButton>
              <div v-if="optionsError" class="text-[13px] text-red-600 mt-2">
                {{ optionsError }}
              </div>
            </div>
          </template>

          <div
            v-else
            class="border-t border-slate-100 pt-4 text-[13px] text-slate-400 flex items-center gap-1.5"
          >
            <UIcon name="i-lucide-info" class="w-3.5 h-3.5" />
            {{ freeTypeHint }}
          </div>
        </UCard>

        <div class="flex justify-end gap-2.5">
          <NuxtLink
            to="/attributes"
            class="border border-slate-200 bg-white text-slate-700 text-[15px] font-semibold px-5 py-2.5 rounded-lg cursor-pointer no-underline"
          >
            Cancel
          </NuxtLink>
          <UButton
            variant="ghost"

            :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[22px] py-2.5 rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors' }"
            @click="onSave"
          >
            Save
          </UButton>
        </div>
      </div>

      <!-- preview -->
      <div class="grow shrink basis-[300px] min-w-0">
        <UCard class="sticky top-5 p-6">
          <div class="flex items-center gap-2 mb-4">
            <UIcon name="i-lucide-eye" class="w-4 h-4 text-green-600" />
            <h2 class="text-base font-bold text-slate-900 m-0">
              Preview
            </h2>
          </div>
          <label class="field-label">{{ previewLabel }}</label>

          <input
            v-if="type === 'Text'"
            class="field-input"
            type="text"
            :placeholder="previewPlaceholder"
            disabled
          >
          <input
            v-else-if="type === 'Numeric'"
            class="field-input"
            type="number"
            placeholder="0"
            disabled
          >
          <select v-else-if="type === 'Select'" class="field-input" disabled>
            <option v-for="o in previewOptions" :key="o">
              {{ o }}
            </option>
          </select>
          <div v-else class="flex flex-col gap-2.5">
            <label
              v-for="o in previewOptions"
              :key="o"
              class="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                :type="type === 'Radio' ? 'radio' : 'checkbox'"
                name="attr-preview"
                disabled
                class="w-4 h-4 accent-green-500"
              >
              {{ o }}
            </label>
          </div>

          <div class="text-[12.5px] text-slate-400 mt-3.5">
            Illustrative only — shows how this attribute's input will appear.
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
select.field-input {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 40px;
  background-color: #fff;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 14px center;
  background-size: 16px 16px;
  cursor: pointer;
}
</style>
