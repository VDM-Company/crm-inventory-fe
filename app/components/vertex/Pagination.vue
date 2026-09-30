<script setup lang="ts">
/**
 * Range label + prev / numbered pages / next control.
 *
 * The host keeps its own wrapper spacing (a table footer has `border-t` and
 * padding, a panel just has a top margin) — pass those through `class`.
 */
const props = withDefaults(defineProps<{
  page: number
  totalPages: number
  label?: string
  /** `md` matches the table footers, `sm` the narrower panel footers */
  size?: 'md' | 'sm'
}>(), {
  label: '',
  size: 'md'
})

defineEmits<{ 'update:page': [number] }>()

const pageNumbers = computed(() => Array.from({ length: props.totalPages }, (_, i) => i + 1))
const textClass = computed(() => props.size === 'sm' ? 'text-[13px]' : 'text-[15px]')
const iconClass = computed(() => props.size === 'sm' ? 'w-[15px] h-[15px]' : 'w-4 h-4')
</script>

<template>
  <div class="flex items-center justify-between gap-3 flex-wrap">
    <span class="text-slate-500" :class="textClass">{{ label }}</span>
    <div class="flex items-center gap-1.5">
      <UButton
        variant="ghost"
        title="Previous"
        :ui="{ base: ['w-8 h-8 rounded-lg inline-flex items-center justify-center border border-slate-200 bg-white p-0', page <= 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'] }"
        @click="$emit('update:page', page - 1)"
      >
        <UIcon name="i-lucide-chevron-left" :class="iconClass" />
      </UButton>
      <UButton
        v-for="p in pageNumbers"
        :key="p"
        variant="ghost"
        :ui="{ base: [
          'min-w-8 h-8 px-2 rounded-lg font-semibold inline-flex items-center justify-center border',
          textClass,
          p === page ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        ] }"
        @click="$emit('update:page', p)"
      >
        {{ p }}
      </UButton>
      <UButton
        variant="ghost"
        title="Next"
        :ui="{ base: ['w-8 h-8 rounded-lg inline-flex items-center justify-center border border-slate-200 bg-white p-0', page >= totalPages ? 'text-slate-300 cursor-not-allowed' : 'text-slate-700 hover:bg-slate-50'] }"
        @click="$emit('update:page', page + 1)"
      >
        <UIcon name="i-lucide-chevron-right" :class="iconClass" />
      </UButton>
    </div>
  </div>
</template>
