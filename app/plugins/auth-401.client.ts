import { isSessionEnding } from '#shared/utils/auth'

/**
 * A session that stopped working mid-visit.
 *
 * An upstream token can be revoked or expire while a tab is open. Without
 * this, every screen independently shows "Could not load…" forever and the
 * reader has no way to know that signing in again is the fix.
 *
 * Only 401 is handled. A 403 means signed in but not allowed, which is a real
 * answer the screen should show rather than a reason to sign out.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()

  globalThis.$fetch = $fetch.create({
    onResponseError({ response }) {
      if (response.status !== 401) return

      // By CODE, not by status. A 401 that does not mean "your session is
      // over" belongs to the screen that asked — bouncing on all of them
      // threw people out of the app whenever an endpoint answered 401 for
      // its own reasons. The guard's own refusal is `unauthenticated`, so
      // it still lands here.
      const body = response._data as { statusMessage?: string, data?: { code?: string } } | undefined
      if (!isSessionEnding(body?.statusMessage ?? body?.data?.code)) return

      const current = router.currentRoute.value
      if (current.path === '/login') return

      // `router.replace` rather than `navigateTo`: this runs inside a fetch
      // interceptor, which is outside any Nuxt context, and `navigateTo`
      // needs one — it fails silently there, which is how this went
      // unnoticed the first time.
      nuxtApp.runWithContext(() => {
        const { user, loaded } = useAuth()
        user.value = null
        loaded.value = true
      })
      router.replace({ path: '/login', query: { redirect: current.fullPath } })
    }
  })
})
