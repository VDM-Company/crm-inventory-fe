// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
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

  // Private by default — only reachable from `server/`. Override at deploy
  // time with NUXT_API_BASE_URL / NUXT_API_TOKEN. While `apiBaseUrl` is empty
  // the `server/api` layer answers from its in-memory mock.
  runtimeConfig: {
    apiBaseUrl: '',
    apiToken: ''
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
