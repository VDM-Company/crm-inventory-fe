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
  // time with NUXT_VERTEX_API_BASE / NUXT_VERTEX_API_TOKEN. With no base
  // configured every `/api` route fails rather than inventing an answer: the
  // in-memory mock that used to stand in for one is gone.
  runtimeConfig: {
    // the Vertex Commerce API (server/utils/vertex.ts). Include the /api/v1
    // prefix; the collection's baseUrl carries it and the paths assume it.
    // Server-only: the token must never reach the browser.
    vertexApiBase: '',
    // Seals the session cookie that holds each user's API token. At least 32
    // characters; `server/utils/session.ts` refuses to run without it.
    sessionPassword: ''
  },

  routeRules: {
    '/': {
      redirect: '/dashboard'
    }
    // No `cors: true` on `/api/**`. The app calls it same-origin and never
    // needed it, and with a session cookie behind the routes that rule would
    // have let any other site's JavaScript drive the API as the visitor.
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
