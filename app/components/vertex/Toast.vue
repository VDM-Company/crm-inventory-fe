<script setup lang="ts">
/**
 * Confirmation toast. Two designs exist in the Vertex screens:
 *  - `light` (default) — bottom-right, white card with a green left border.
 *    Used by the list/config screens.
 *  - `dark` — top-right, slate-900 pill. Used by the two large product forms.
 * Renders nothing when `message` is empty, so callers can bind a nullable ref.
 */
withDefaults(defineProps<{
  message?: string | null
  variant?: 'light' | 'dark'
}>(), {
  message: null,
  variant: 'light'
})
</script>

<template>
  <div
    v-if="message"
    :class="variant === 'dark'
      ? 'fixed top-6 right-6 z-[200] bg-slate-900 text-white px-[18px] py-[13px] rounded-[10px] flex items-center gap-2.5 text-[13px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.25)]'
      : 'fixed bottom-6 right-6 z-[300] bg-white border border-slate-200 border-l-4 border-l-green-500 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.14)] px-[18px] py-3.5 flex items-center gap-3'"
  >
    <template v-if="variant === 'dark'">
      <UIcon name="i-lucide-circle-check-big" class="w-4 h-4 text-green-500" />
      {{ message }}
    </template>
    <template v-else>
      <UIcon name="i-lucide-circle-check" class="w-5 h-5 text-green-600" />
      <span class="text-[15px] font-semibold text-slate-900">{{ message }}</span>
    </template>
  </div>
</template>

<style scoped>
div {
  animation: toastIn 200ms ease;
}
@keyframes toastIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
