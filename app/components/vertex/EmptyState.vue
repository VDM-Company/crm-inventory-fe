<script setup lang="ts">
/**
 * Centred "nothing here yet" panel: a rounded icon tile, a title and a hint,
 * with an optional call-to-action in the default slot.
 */
withDefaults(defineProps<{
  /** lucide icon name without the `i-lucide-` prefix */
  icon: string
  title: string
  hint?: string
  /** a couple of screens widen the hint column slightly */
  hintWidth?: string
}>(), {
  hint: '',
  hintWidth: '340px'
})
</script>

<template>
  <div class="px-6 py-14 flex flex-col items-center gap-2.5 text-center">
    <div class="w-[52px] h-[52px] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
      <UIcon :name="'i-lucide-' + icon" class="w-6 h-6" />
    </div>
    <div class="text-base font-bold text-slate-900">
      {{ title }}
    </div>
    <div v-if="hint" class="text-[15px] text-slate-400" :style="{ maxWidth: hintWidth }">
      {{ hint }}
    </div>
    <slot />
  </div>
</template>
