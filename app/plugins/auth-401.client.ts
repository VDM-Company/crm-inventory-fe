import { isSessionEnding } from '#shared/utils/auth'

/**
 * A session that stopped working mid-visit.
 *
 * An upstream token can be revoked or expire while a tab is open. Without
 * this, every screen independently shows "Could not load…" forever and the
 * reader has no way to know that signing in again is the fix.
 *
 * Only 401 is handled, and only by CODE. A 403 means signed in but not
 * allowed, and a 401 that is not session-ending belongs to the screen that
 * asked — bouncing on every 401 threw people out whenever they saved a price,
 * because the Postman mock answers that write with a saved 401 of its own.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  globalThis.$fetch = $fetch.create({
    onResponseError({ response }) {
      if (response.status !== 401) return

      const body = response._data as { statusMessage?: string, data?: { code?: string } } | undefined
      if (!isSessionEnding(body?.statusMessage ?? body?.data?.code)) return

      const current = router.currentRoute.value
      if (current.path === '/login') return

      /*
       * Forget the session SYNCHRONOUSLY, before navigating.
       *
       * `clear()` would be the polite call, but it is async and it DELETEs a
       * session the server has already dropped. Worse, leaving the client
       * state alone for even one tick means the route middleware still sees
       * `loggedIn`, takes its "already signed in, so no reason to show the
       * form" branch, and bounces straight back to the page just left. That
       * is exactly what happened here: the interceptor fired, matched, and
       * called `replace`, and the navigation quietly undid itself.
       *
       * `session` is the module's own `useState` ref, so writing it is what
       * `loggedIn` reads on the very next tick.
       */
      nuxtApp.runWithContext(() => {
        useUserSession().session.value = null
      })
      // `router.replace` rather than `navigateTo`: this runs inside a fetch
      // interceptor, which is outside any Nuxt context, and `navigateTo`
      // needs one — it fails silently there.
      router.replace({ path: '/login', query: { redirect: current.fullPath } })
    }
  })
})
