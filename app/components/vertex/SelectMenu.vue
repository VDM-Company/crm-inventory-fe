<script setup lang="ts">
/**
 * The design's own dropdown: a bordered trigger, a chevron that flips, a
 * click-catching backdrop and a floating option list.
 *
 * It is NOT `USelect`. The native `<select>`s were migrated to USelect, but
 * these are different controls — the category picker indents by tree depth,
 * the platform picker is an "add" menu whose options never read as selected,
 * and both sit inside layouts that rely on this exact trigger geometry.
 *
 * Open state stays with the page: the screens keep a single `openDropdown` key
 * so that opening one closes the others.
 */
export interface SelectMenuItem {
  value: string
  name: string
  selected?: boolean
  /** Overrides the default option style — the category tree indents with it. */
  style?: string
  /** Free-form extras for the `option` slot, e.g. the stock picker's dot colour. */
  meta?: Record<string, unknown>
}

withDefaults(defineProps<{
  open: boolean
  label: string
  items: SelectMenuItem[]
  /** Greys the label when nothing is chosen yet. */
  placeholder?: boolean
  /** Caps the list and scrolls, for the long category/platform lists. */
  maxHeight?: string
  /** Disables the trigger — keeps the focus and screen-reader semantics the
   *  native `disabled` attribute gave before this was a component. */
  locked?: boolean
}>(), {
  placeholder: false,
  maxHeight: '',
  locked: false
})

const emit = defineEmits<{
  toggle: []
  close: []
  select: [value: string]
}>()

function triggerStyle(open: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid ${open ? '#00c16a' : '#e2e8f0'};border-radius:8px;padding:9px 12px;height:40px;font-size:14px;background:#fff;cursor:pointer;color:#0f172a;${open ? 'box-shadow:0 0 0 3px rgba(0,193,106,0.15);' : ''}`
}
function chevronStyle(open: boolean) {
  return `display:inline-flex;align-items:center;color:#64748b;flex-shrink:0;transition:transform 150ms ease;transform:rotate(${open ? '180deg' : '0deg'});`
}
function optionStyle(selected: boolean) {
  return `width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:none;border-radius:6px;background:${selected ? '#ecfdf5' : 'transparent'};padding:8px 10px;font-size:14px;color:${selected ? '#047857' : '#334155'};font-weight:${selected ? 600 : 400};cursor:pointer;`
}
</script>

<template>
  <button
    type="button"
    :disabled="locked"
    :style="triggerStyle(open) + (locked ? 'cursor:not-allowed;' : '')"
    @click="emit('toggle')"
  >
    <span
      class="whitespace-nowrap overflow-hidden text-ellipsis"
      :class="placeholder ? 'text-slate-400' : ''"
    ><slot name="label">{{ label }}</slot></span>
    <span :style="chevronStyle(open)"><UIcon name="i-lucide-chevron-down" class="w-4 h-4" /></span>
  </button>

  <template v-if="open">
    <div class="fixed inset-0 z-40" @click="emit('close')" />
    <div
      class="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border border-slate-200 rounded-lg shadow-[0_10px_30px_rgba(0,0,0,0.14)] p-1"
      :class="maxHeight ? 'overflow-y-auto' : ''"
      :style="maxHeight ? { maxHeight } : undefined"
    >
      <button
        v-for="opt in items"
        :key="opt.value"
        type="button"
        :style="opt.style || optionStyle(!!opt.selected)"
        @click="emit('select', opt.value)"
      >
        <span><slot name="option" :item="opt">{{ opt.name }}</slot></span>
        <UIcon v-if="opt.selected" name="i-lucide-check" class="w-[15px] h-[15px] text-green-600" />
      </button>

      <slot name="empty" />
    </div>
  </template>
</template>
