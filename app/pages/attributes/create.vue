<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { Attribute, AttributeInputType } from '~/types'

const route = useRoute()

// The API's own vocabulary. `Numeric` and `Checkbox` are gone because the API
// does not define them; `Swatch` is new for the same reason.
const INPUT_TYPES = Object.values(INPUT_TYPE_LABELS)
const OPTION_TYPES = OPTION_INPUT_TYPES.map(inputTypeLabel)

const editId = computed(() => {
  const raw = route.query.id
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && v ? v : null
})

// ── state ──
const attributesApi = useApiAttributesV2()

const attrs = ref<Attribute[]>([])
/** The record being edited, kept whole for its option ids and lockVersion. */
const editing = ref<Attribute | null>(null)
// UForm drives validation off a single reactive state object; `name`/`type`
// stay as computed refs so the rest of the page (preview, option rows) is
// untouched.
const state = reactive({ name: '', type: 'Dropdown', code: '' })
const name = computed({ get: () => state.name, set: v => (state.name = v) })
const type = computed({ get: () => state.type, set: v => (state.type = v) })
const required = ref(true)
const codeTouched = ref(false)
/**
 * Option rows carry the id the API gave them.
 *
 * The old form held plain strings and saved the array whole, which made a
 * rename indistinguishable from a delete plus an add. Products reference
 * option ids, so the difference matters: renaming keeps every product that
 * chose the option.
 */
const options = ref<OptionRow[]>([{ id: null, label: '' }])
const optionsError = ref('')
const saveError = ref('')
// true from the first render when editing, so the server does not ship a
// blank Create form that the fetch then overwrites
const loading = ref(!!editId.value)

const pageTitle = computed(() => editId.value ? 'Edit Attribute' : 'Create Attribute')
useHead({ title: () => pageTitle.value + ' — Vertex' })

// The list is fetched on mount, then the edited attribute seeds the form.
onMounted(async () => {
  try {
    attrs.value = await attributesApi.list()
  } catch (err) {
    saveError.value = apiErrorMessage(err, 'Could not load attributes.')
    return
  } finally {
    loading.value = false
  }
  if (!editId.value) return
  const existing = attrs.value.find(a => a.id === editId.value)
  if (!existing) return
  editing.value = existing
  name.value = localized(existing.label)
  type.value = inputTypeLabel(existing.inputType)
  state.code = existing.code
  codeTouched.value = true
  required.value = true
  options.value = (existing.options || []).map(o => ({ id: o.id, label: localized(o.label) }))
})

// Schema is a computed so the duplicate-name refinement sees the current
// store and the row being edited.
const schema = computed(() => z.object({
  name: z.string()
    .trim()
    .min(1, 'Attribute name is required.')
    .refine(
      v => !attrs.value.some(a => localized(a.label).toLowerCase() === v.toLowerCase() && a.id !== editId.value),
      'An attribute with this name already exists.'
    ),
  type: z.string().min(1, 'Type is required.'),
  code: z.string()
    .trim()
    .regex(FEE_ITEM_CODE_PATTERN, 'Use 2–50 lowercase letters, digits or underscores.')
    .refine(
      v => !attrs.value.some(a => a.code === v && a.id !== editId.value),
      'An attribute with this code already exists.'
    )
    .optional()
}))
type Schema = { name: string, type: string, code?: string }

const isOptionType = computed(() => OPTION_TYPES.indexOf(type.value) !== -1)
const freeTypeHint = computed(() => 'Text inputs have no predefined values.')

// The code is derived from the name until someone types their own. It cannot
// change after creation, so the field only shows on a create.
function onNameInput(v: string) {
  state.name = v
  if (!editId.value && !codeTouched.value) state.code = slugifyCode(v)
}
function onCodeInput(v: string) {
  state.code = v
  codeTouched.value = true
}

// ── option rows ──
function setOption(i: number, v: string) {
  options.value = options.value.map((o, idx) => idx === i ? { ...o, label: v } : o)
  optionsError.value = ''
}
function addOption() {
  options.value = [...options.value, { id: null, label: '' }]
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
    value: o.label,
    isFirst: i === 0,
    isLast: i === options.value.length - 1,
    upStyle: arrowStyle(i === 0),
    downStyle: arrowStyle(i === options.value.length - 1)
  }))
)

// ── required toggle ──
// ── live preview ──
const cleanedOptions = computed(() =>
  options.value.map(o => ({ ...o, label: (o.label || '').trim() })).filter(o => o.label)
)
const cleanedLabels = computed(() => cleanedOptions.value.map(o => o.label))
const previewOptions = computed(() => cleanedLabels.value.length ? cleanedLabels.value : ['Option 1', 'Option 2'])
const previewLabel = computed(() => name.value || 'Attribute')
const previewPlaceholder = computed(() => 'Enter ' + (name.value || 'value').toLowerCase())

/**
 * An edit is several requests, because the API manages options through their
 * own endpoints rather than as a field on the attribute.
 *
 * Order matters: remove first so a label freed by a deletion can be reused by
 * a rename in the same save, then rename, then create what is new, then set
 * the order over the resulting ids. `reorderOptions` wants every id, so the
 * new ones have to exist before it runs.
 */
async function saveExisting(id: string, label: { en: string }, inputType: AttributeInputType) {
  const saved = editing.value?.options || []
  const rows = cleanedOptions.value
  const { removedIds, renamed } = diffAttributeOptions(saved, rows)

  for (const optionId of removedIds) await attributesApi.removeOption(id, optionId)
  for (const r of renamed) await attributesApi.updateOption(id, r.id, { label: { en: r.label } })

  const orderedIds: string[] = []
  for (const row of rows) {
    if (row.id) {
      orderedIds.push(row.id)
    } else {
      const created = await attributesApi.addOption(id, { label: { en: row.label } })
      orderedIds.push(created.id)
    }
  }

  const updated = await attributesApi.update(id, { label, inputType }, editing.value?.lockVersion ?? 0)
  editing.value = updated

  if (orderedIds.length > 1) await attributesApi.reorderOptions(id, orderedIds)
}

/**
 * The server's own wording is usually best, but two codes carry more than a
 * message and deserve to say so: a stale version means re-read, and `in_use`
 * on an option names how many products still choose it.
 */
function describeSaveError(err: unknown): string {
  const code = apiErrorCode(err)
  if (code === 'stale_version') {
    return 'Someone else changed this attribute. Reload the page before saving again.'
  }
  if (code === 'in_use') {
    const used = Number(apiErrorDetails(err).usageCount)
    return Number.isFinite(used) && used > 0
      ? `That value is used by ${used} product${used === 1 ? '' : 's'}. Remove it from them before deleting it.`
      : 'That value is still used by a product. Remove it from them before deleting it.'
  }
  return apiErrorMessage(err, 'Could not save the attribute.')
}

// ── save ──
// UForm validates name/type against the schema before this runs; the
// option-count rule depends on the `required` toggle and stays here.
const saving = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  if (isOptionType.value && required.value && cleanedOptions.value.length === 0) {
    optionsError.value = 'Add at least one value.'
    return
  }
  if (saving.value) return
  saving.value = true
  const label = { en: event.data.name }
  const inputType = labelToInputType(event.data.type) as AttributeInputType

  try {
    if (editId.value) {
      await saveExisting(editId.value, label, inputType)
    } else {
      // on a create the API takes the first options inline and assigns their ids
      await attributesApi.create({
        code: event.data.code ?? state.code,
        label,
        inputType,
        options: cleanedLabels.value.map(l => ({ label: { en: l } }))
      })
    }
  } catch (err) {
    saving.value = false
    saveError.value = describeSaveError(err)
    return
  }
  saving.value = false
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
        class="hover:bg-slate-100 w-[38px] h-[38px] border border-slate-200 bg-white rounded-lg inline-flex items-center justify-center text-slate-700 flex-shrink-0"
      >
        <UIcon name="i-lucide-arrow-left" class="w-[18px] h-[18px]" />
      </NuxtLink>
      <h1 class="text-2xl font-bold text-slate-900 m-0">
        {{ pageTitle }}
      </h1>
    </div>

    <VertexLoadingPanel v-if="loading" label="Loading attribute…" />

    <UForm

      v-else
      :schema="schema"
      :state="state"
      class="flex gap-6 items-start flex-wrap"
      @submit="onSubmit"
    >
      <!-- config -->
      <div class="grow shrink basis-[420px] min-w-0 flex flex-col gap-6">
        <UCard class="p-6">
          <h2 class="text-base font-bold text-slate-900 mt-0 mb-5">
            Attribute Details
          </h2>

          <UFormField
            name="name"
            label="Attribute Name"
            required
            class="mb-[18px]"
          >
            <UInput
              :model-value="state.name"
              placeholder="e.g. Duration"
              @update:model-value="onNameInput(String($event))"
            />
          </UFormField>

          <UFormField
            v-if="!editId"
            name="code"
            label="Code"
            required
            class="mb-[18px]"
            help="Identifies this attribute to the API. Lowercase letters, digits and underscores."
          >
            <UInput
              :model-value="state.code"
              placeholder="e.g. screen_size"
              @update:model-value="onCodeInput(String($event))"
            />
          </UFormField>
          <div v-else class="mb-[18px]">
            <label class="field-label">Code</label>
            <p class="text-[13px] text-slate-400 m-0">
              <code class="text-slate-600">{{ state.code }}</code> — set when the attribute was created and
              cannot be changed.
            </p>
          </div>

          <UFormField
            name="type"
            label="Input Type"
            required
            class="mb-[18px]"
          >
            <USelect
              v-model="type"
              :items="INPUT_TYPES"
              :ui="{ trailing: 'pe-[14px]' }"
              @update:model-value="optionsError = ''"
            />
          </UFormField>

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
              <USwitch v-model="required" />
            </div>

            <div class="mt-2">
              <label class="field-label">Manage Options</label>
              <div class="flex flex-col gap-2">
                <div v-for="o in optionRows" :key="o.index" class="flex items-center gap-2">
                  <div class="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      type="button"
                      :disabled="o.isFirst"
                      title="Move up"
                      class="hover:bg-slate-100"
                      :style="o.upStyle"
                      @click="moveOption(o.index, -1)"
                    >
                      <UIcon name="i-lucide-chevron-up" class="w-[13px] h-[13px]" />
                    </button>
                    <button
                      type="button"
                      :disabled="o.isLast"
                      title="Move down"
                      class="hover:bg-slate-100"
                      :style="o.downStyle"
                      @click="moveOption(o.index, 1)"
                    >
                      <UIcon name="i-lucide-chevron-down" class="w-[13px] h-[13px]" />
                    </button>
                  </div>
                  <UInput
                    :model-value="o.value"
                    placeholder="Option value"
                    class="flex-1"
                    @update:model-value="setOption(o.index, String($event))"
                  />
                  <UButton
                    variant="ghost"

                    title="Delete option"

                    :ui="{ base: 'hover:bg-slate-100 border border-slate-200 bg-white text-red-600 w-10 h-10 rounded-lg cursor-pointer flex items-center justify-center flex-shrink-0' }"
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
            type="submit"
            variant="ghost"
            :disabled="saving"
            :ui="{ base: 'border-none bg-green-500 text-white text-[15px] font-bold px-[22px] py-2.5 rounded-lg cursor-pointer shadow-sm hover:bg-green-600 transition-colors' }"
          >
            Save
          </UButton>
        </div>

        <div
          v-if="saveError"
          class="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-[13px] text-red-700"
        >
          <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
          <span>{{ saveError }}</span>
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

          <UInput
            v-if="type === 'Text'"
            :placeholder="previewPlaceholder"
            disabled
          />
          <UInput
            v-else-if="type === 'Numeric'"
            type="number"
            placeholder="0"
            disabled
          />
          <USelect
            v-else-if="type === 'Select'"
            :model-value="previewOptions[0]"
            :items="previewOptions"
            disabled
            :ui="{ trailing: 'pe-[14px]' }"
          />
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
    </UForm>
  </div>
</template>
