<script setup lang="ts">
/** Inline failure notice for a load or save that did not go through. */
defineProps<{ message?: string }>()
</script>

<template>
  <div
    v-if="message"
    class="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3.5 py-3 text-[13px] text-red-700"
  >
    <UIcon name="i-lucide-circle-alert" class="w-[15px] h-[15px] flex-shrink-0" />
    <span>{{ message }}</span>
  </div>
</template>
