<script setup lang="ts">
import type { PreviewLine } from '#shared/utils/variant-generate'

/**
 * One block of the variant-generation confirmation: what is about to be
 * created, removed, switched off or kept.
 *
 * Its own component because the four blocks differ only in colour and words,
 * and the point of the dialog is that all four are easy to read at once.
 */
const props = defineProps<{
  tone: 'create' | 'delete' | 'disable' | 'keep'
  icon: string
  title: string
  subtitle?: string
  rows: PreviewLine[]
}>()

const TONES = {
  create: 'text-green-700 bg-emerald-50 border-emerald-200',
  delete: 'text-red-700 bg-red-50 border-red-200',
  disable: 'text-amber-700 bg-amber-50 border-amber-200',
  keep: 'text-slate-600 bg-slate-50 border-slate-200'
} as const

const toneClass = computed(() => TONES[props.tone])
</script>

<template>
  <div class="border rounded-lg px-3.5 py-3" :class="toneClass">
    <div class="flex items-center gap-1.5 text-[13px] font-bold">
      <UIcon :name="icon" class="w-3.5 h-3.5 flex-shrink-0" />
      {{ title }}
    </div>
    <p v-if="subtitle" class="text-xs opacity-80 m-0 mt-0.5">
      {{ subtitle }}
    </p>
    <ul class="list-none p-0 m-0 mt-2 flex flex-col gap-1">
      <li
        v-for="row in rows"
        :key="row.id"
        class="text-[13px] flex items-baseline gap-2"
      >
        <span class="font-medium">{{ row.label }}</span>
        <span v-if="row.sku" class="font-mono text-xs opacity-70">{{ row.sku }}</span>
      </li>
    </ul>
  </div>
</template>
