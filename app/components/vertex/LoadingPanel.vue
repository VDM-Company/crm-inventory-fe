<script setup lang="ts">
/** Centred "fetching" panel for screens whose whole body is one record. */
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' })
</script>

<template>
  <div
    class="px-6 py-14 flex flex-col items-center gap-2.5 text-center"
    aria-busy="true"
    aria-live="polite"
  >
    <div class="w-[52px] h-[52px] rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
      <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin" />
    </div>
    <div class="text-[15px] text-slate-400">
      {{ label }}
    </div>
  </div>
</template>
