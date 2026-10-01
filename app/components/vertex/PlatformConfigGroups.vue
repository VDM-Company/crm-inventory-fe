<script setup lang="ts">
import type { ConfigValue, ConfigValues } from '~/types'

/**
 * The four collapsible platform-configuration groups (Store Information, Web,
 * General Contact, Contact Us), shared by Create Platform and Edit Platform.
 *
 * The Base URL field is `synced`: it mirrors the identity URL / Path field on
 * the host page, renders locked with a "Synced" badge, and is never written
 * into the model — the host owns that value and stamps it in on save.
 */
const props = defineProps<{
  modelValue: ConfigValues
  /** the page's URL / Path value, mirrored into the locked Base URL field */
  syncedUrl?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [ConfigValues] }>()

const openGroups = reactive<Record<string, boolean>>({
  store: true,
  web: true,
  contact: true,
  contactus: true
})

function toggleGroup(group: string) {
  openGroups[group] = !openGroups[group]
}

function setCfg(key: string, value: ConfigValue) {
  emit('update:modelValue', { ...props.modelValue, [key]: value })
}

interface FieldView {
  key: string
  label: string
  isToggle: boolean
  isTextarea: boolean
  isText: boolean
  placeholder: string
  value: string
  on: boolean
  locked: boolean
  showBadge: boolean
  badgeLabel: string
  hint: string
}

const groups = computed(() => CONFIG_GROUPS.map(def => ({
  group: def.group,
  title: def.title,
  icon: 'i-lucide-' + def.icon,
  open: !!openGroups[def.group],
  fields: def.fields.map<FieldView>((fd) => {
    if (fd.synced) {
      return {
        key: fd.key,
        label: fd.label,
        isToggle: false,
        isTextarea: false,
        isText: true,
        placeholder: fd.placeholder || '',
        value: props.syncedUrl || '',
        on: false,
        locked: true,
        showBadge: true,
        badgeLabel: 'Synced',
        hint: 'Synced with URL / Path above — edit it there.'
      }
    }
    const val = props.modelValue[fd.key]
    return {
      key: fd.key,
      label: fd.label,
      isToggle: fd.type === 'toggle',
      isTextarea: fd.type === 'textarea',
      isText: fd.type === 'text',
      placeholder: fd.placeholder || '',
      value: fd.type === 'toggle' ? '' : (val == null ? '' : String(val)),
      on: !!val,
      locked: false,
      showBadge: false,
      badgeLabel: '',
      hint: ''
    }
  })
})))
</script>

<template>
  <div class="flex flex-col gap-4">
    <UCard
      v-for="g in groups"
      :key="g.group"
      class="overflow-hidden"
    >
      <UButton
        variant="ghost"

        type="button"

        :ui="{ base: 'w-full flex items-center justify-between gap-3 px-5 py-4 bg-white border-none cursor-pointer text-left' }"
        @click="toggleGroup(g.group)"
      >
        <div class="flex items-center gap-2.5">
          <UIcon :name="g.icon" class="w-[17px] h-[17px] text-green-600" />
          <span class="text-base font-bold text-slate-900">{{ g.title }}</span>
        </div>
        <span
          class="inline-flex transition-transform duration-150"
          :class="g.open ? 'rotate-180' : ''"
        >
          <UIcon name="i-lucide-chevron-down" class="w-[18px] h-[18px] text-slate-400" />
        </span>
      </UButton>

      <div v-if="g.open" class="px-5 pt-1 pb-5 flex flex-col gap-[18px] border-t border-slate-100">
        <div v-for="f in g.fields" :key="f.key">
          <div class="flex items-center justify-between gap-3 mb-1.5">
            <label class="field-label mb-0">{{ f.label }}</label>
            <span
              v-if="f.showBadge"
              class="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200"
            >{{ f.badgeLabel }}</span>
          </div>

          <UButton
            v-if="f.isToggle"

            variant="ghost"

            :ui="{ base: ['w-10 h-[22px] rounded-full border-none cursor-pointer relative p-0.5 inline-flex items-center transition-colors', f.on ? 'bg-green-500' : 'bg-slate-200'] }"
            @click="setCfg(f.key, !f.on)"
          >
            <span
              class="w-[18px] h-[18px] rounded-full bg-white block shadow-sm transition-transform duration-150"
              :class="f.on ? 'translate-x-[18px]' : 'translate-x-0'"
            />
          </UButton>

          <UTextarea
            v-else-if="f.isTextarea"
            :model-value="f.value"
            :rows="3"
            :disabled="f.locked"
            :placeholder="f.placeholder"
            :ui="fieldUi('resize-y')"
            @change="setCfg(f.key, ($event.target as HTMLTextAreaElement).value)"
          />

          <UInput
            v-else
            :model-value="f.value"
            :disabled="f.locked"
            :placeholder="f.placeholder"
            @change="setCfg(f.key, ($event.target as HTMLInputElement).value)"
          />

          <div v-if="f.hint" class="text-[12.5px] text-slate-400 mt-1.5 flex items-center gap-[5px]">
            <UIcon name="i-lucide-info" class="w-3 h-3 flex-shrink-0" />{{ f.hint }}
          </div>
        </div>
      </div>
    </UCard>
  </div>
</template>
