// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@vueuse/nuxt'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // Every Vertex screen is a light-mode pixel port of the design. Nuxt UI ships
  // @nuxtjs/color-mode, which was resolving to `dark` from the OS preference —
  // invisible while only UIcon was used, but wrong the moment themed components
  // (UInput/UModal/UTable) were adopted. Disable the integration outright.
  ui: {
    colorMode: false
  },

  routeRules: {
    '/': {
      redirect: '/dashboard'
    },
    '/api/**': {
      cors: true
    }
  },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
