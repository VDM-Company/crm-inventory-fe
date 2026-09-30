<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

/**
 * Slash-separated page breadcrumb.
 *
 * Each item renders as:
 *  - a green link when it has `to`
 *  - bold slate-900 when it is the last item, or when `strong` is set
 *    (some screens bold more than one trailing segment)
 *  - a plain green label otherwise (e.g. the non-navigable "Configuration")
 */
export interface Crumb {
  label: string
  to?: RouteLocationRaw
  strong?: boolean
}

withDefaults(defineProps<{
  items: Crumb[]
  /** tighter bottom margin, for breadcrumbs stacked directly above a page title */
  dense?: boolean
}>(), { dense: false })
</script>

<template>
  <div class="text-[13px] text-slate-500" :class="dense ? 'mb-1' : 'mb-3.5'">
    <template v-for="(item, i) in items" :key="i">
      <NuxtLink
        v-if="item.to"
        :to="item.to"
        class="text-green-600 no-underline hover:text-green-700"
      >{{ item.label }}</NuxtLink>
      <span
        v-else-if="item.strong || i === items.length - 1"
        class="text-slate-900 font-semibold"
      >{{ item.label }}</span>
      <span v-else class="text-green-600">{{ item.label }}</span>
      <span v-if="i < items.length - 1" class="text-slate-300"> / </span>
    </template>
  </div>
</template>
