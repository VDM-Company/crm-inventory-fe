<script setup lang="ts">
/**
 * Active / Inactive pill. `active` drives the colour; the label defaults to
 * the usual wording but can be overridden (e.g. "Published" / "Gift").
 *
 * `sm` (12px) is the detail/table pill, `md` (14px) the dashboard's larger one.
 */
withDefaults(defineProps<{
  active?: boolean
  label?: string
  size?: 'sm' | 'md'
}>(), {
  active: false,
  label: '',
  size: 'sm'
})
</script>

<template>
  <span
    class="inline-block font-bold rounded-full border"
    :class="[
      size === 'md' ? 'text-sm px-3 py-[3px]' : 'text-xs px-3 py-[3px]',
      active ? 'bg-emerald-50 text-green-600 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
    ]"
  >{{ label || (active ? 'Active' : 'Inactive') }}</span>
</template>
