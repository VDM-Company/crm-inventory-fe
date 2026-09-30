<script setup lang="ts">
/**
 * Centred confirm dialog used for deletes and discard-changes prompts.
 *
 * Built on Nuxt UI's `UModal` (focus trap, Escape handling, scroll lock and
 * teleport come from it); the card itself is rendered through `#content` so it
 * keeps the design's exact chrome.
 *
 * `tone` drives the round icon chip:
 *  - `danger`  — red, the normal destructive confirm
 *  - `warning` — amber, used both for "Discard changes?" and for the blocked
 *    delete variant (where `showConfirm` is false and only Close remains).
 */
withDefaults(defineProps<{
  open?: boolean
  title?: string
  message?: string
  /** lucide icon name without the `i-lucide-` prefix; '' renders no icon chip */
  icon?: string
  tone?: 'danger' | 'warning' | 'success'
  /** tighter scale used by the two large product forms */
  compact?: boolean
  cancelLabel?: string
  confirmLabel?: string
  /** hidden for usage-guarded deletes, leaving only the cancel button */
  showConfirm?: boolean
  /**
   * Literal Tailwind width class for the dialog card (e.g. `w-[420px]`).
   * Must be a literal at the call site so Tailwind's scanner sees it.
   */
  widthClass?: string
}>(), {
  open: false,
  title: '',
  message: '',
  icon: 'triangle-alert',
  tone: 'danger',
  compact: false,
  cancelLabel: 'Cancel',
  confirmLabel: 'Delete',
  showConfirm: true,
  widthClass: 'w-[440px]'
})

const emit = defineEmits<{ cancel: [], confirm: [] }>()

// UModal owns the open state; closing it any way (Escape, overlay click) is a
// cancel as far as the host is concerned.
function onOpenChange(value: boolean) {
  if (!value) emit('cancel')
}
</script>

<template>
  <UModal
    :open="open"
    :title="title"
    :description="message"
    :ui="{
      overlay: 'bg-slate-900/45 backdrop-blur-[2px]',
      content: ['bg-white rounded-[14px] max-w-[92vw] shadow-[0_20px_60px_rgba(0,0,0,0.25)] p-6 divide-y-0 ring-0', widthClass]
    }"
    @update:open="onOpenChange"
  >
    <template #content>
      <div>
        <div class="flex items-center mb-2" :class="compact ? 'gap-2.5' : 'gap-3'">
          <div
            v-if="icon"
            class="rounded-full flex items-center justify-center flex-shrink-0"
            :class="{
              'w-9 h-9': compact,
              'w-11 h-11': !compact,
              'bg-amber-50 text-amber-600': tone === 'warning',
              'bg-red-50 text-red-600': tone === 'danger',
              'bg-emerald-50 text-green-600': tone === 'success'
            }"
          >
            <UIcon :name="'i-lucide-' + icon" :class="compact ? 'w-[18px] h-[18px]' : 'w-[22px] h-[22px]'" />
          </div>
          <h3 class="font-bold text-slate-900 m-0" :class="compact ? 'text-base' : 'text-[17px]'">
            {{ title }}
          </h3>
        </div>

        <p class="text-slate-500 mt-0 mb-5 leading-normal" :class="compact ? 'text-sm' : 'text-[15px]'">
          <slot>{{ message }}</slot>
        </p>

        <div class="flex justify-end gap-2.5">
          <UButton
            color="neutral"
            variant="ghost"
            :label="cancelLabel"
            :ui="{ base: [BTN_OUTLINE, compact ? 'text-sm px-4 py-[9px]' : 'text-[15px] px-[18px] py-[9px]'] }"
            @click="emit('cancel')"
          />
          <UButton
            v-if="showConfirm"
            :color="tone === 'success' ? 'primary' : 'error'"
            variant="ghost"
            :label="confirmLabel"
            :ui="{ base: [
              tone === 'success' ? BTN_PRIMARY : BTN_DANGER,
              'px-[18px] py-[9px]',
              compact ? 'text-sm' : 'text-[15px]'
            ] }"
            @click="emit('confirm')"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
