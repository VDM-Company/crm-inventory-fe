<script setup lang="ts">
/**
 * Placeholder rows shown while a table's data is in flight.
 *
 * It replaces the old behaviour of rendering seed rows before the fetch
 * landed: those looked like real records, and against a slow API they were
 * visible long enough to click.
 *
 * Sized to the table body so the panel does not jump when the real rows
 * arrive — `rows` should match the page size the screen usually shows.
 */
withDefaults(defineProps<{
  rows?: number
  /** relative widths of the shimmer bars in each row */
  columns?: string[]
}>(), {
  rows: 5,
  columns: () => ['40%', '20%', '25%', '15%']
})
</script>

<template>
  <div class="px-5 py-3" aria-busy="true" aria-live="polite">
    <span class="sr-only">Loading…</span>
    <div
      v-for="r in rows"
      :key="r"
      class="flex items-center gap-4 py-3.5 border-b border-slate-100 last:border-b-0"
    >
      <div
        v-for="(w, i) in columns"
        :key="i"
        class="h-3.5 rounded bg-slate-100 animate-pulse"
        :style="{ width: w }"
      />
    </div>
  </div>
</template>
