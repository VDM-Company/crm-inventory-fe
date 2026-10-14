// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/test-utils/module',
    '@nuxt/ui',
    '@vueuse/nuxt',
    'nuxt-auth-utils'
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

    /*
     * The session cookie `nuxt-auth-utils` keeps the signed-in user in.
     *
     * Three of these harden what the module does not — each checked against
     * its source and h3's rather than assumed:
     *
     * - `sessionHeader: false`. h3 otherwise also accepts a sealed session in
     *   an `x-nuxt-session` request header, and that header WINS over the
     *   cookie. Nothing here needs a second door.
     * - `secure` outside dev only. h3 defaults it to true, and WebKit refuses
     *   to store a Secure cookie on http://localhost, so dev would silently
     *   never stay signed in.
     * - `maxAge`. Without one the cookie dies with the browser session.
     *
     * `password` comes from NUXT_SESSION_PASSWORD (32+ characters); the
     * module writes a generated one into .env on the first dev run.
     */
    session: {
      name: 'vertex_session',
      maxAge: 60 * 60 * 24 * 7,
      sessionHeader: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7
      }
    }
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
