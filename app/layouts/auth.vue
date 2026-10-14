<script setup lang="ts">
// Shell for the pages a signed-out visitor can reach. Same typography as the
// app, without the sidebar — there is nothing to navigate to yet.
useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap' }
  ]
})
</script>

<template>
  <div class="vertex-shell min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center px-4 py-10">
    <slot />
  </div>
</template>

<style scoped>
.vertex-shell {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
