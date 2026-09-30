<script setup lang="ts">
/**
 * Form-field chrome: label (+ required asterisk), the control via the default
 * slot, and an error or hint line below it.
 *
 * The control itself stays in the host — across these screens it is variously
 * an input / textarea / select bound with v-model, `@input` or `@change`, so
 * wrapping it would cost more than it saves.
 *
 * Wrapper spacing is the host's (`class="mb-[18px]"`, `mb-4`, …).
 */
withDefaults(defineProps<{
  label?: string
  required?: boolean
  /** shown instead of `hint` when non-empty */
  error?: string
  hint?: string
}>(), {
  label: '',
  required: false,
  error: '',
  hint: ''
})
</script>

<template>
  <div>
    <label v-if="label" class="field-label">
      {{ label }} <span v-if="required" class="text-red-600">*</span>
    </label>

    <slot />

    <div v-if="error" class="text-[13px] text-red-600 mt-1.5">
      {{ error }}
    </div>
    <div v-else-if="hint" class="text-[13px] text-slate-400 mt-1.5">
      {{ hint }}
    </div>
  </div>
</template>
