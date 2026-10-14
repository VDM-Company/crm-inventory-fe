import { can as hasPermission } from '#shared/utils/auth'

/**
 * Who is signed in, as the screens see it.
 *
 * A thin wrapper over `nuxt-auth-utils`'s `useUserSession()`, kept for two
 * reasons: the screens already read `useAuth()`, and the two things this app
 * adds — `can()` and a logout that forgets the previous user's data — belong
 * somewhere other than every call site.
 *
 * There is no token here, and nothing to get one from. It lives under the
 * session's `secure` key, which the module strips before the session is sent
 * to the browser.
 */
export function useAuth() {
  const { user, loggedIn, ready, fetch, clear } = useUserSession()

  /**
   * Signs out, then sends the browser to the login page with a full reload.
   *
   * `window.location` rather than the router on purpose: it drops every piece
   * of the previous user's data still held in memory — `useState`, fetched
   * lists, open forms — rather than relying on each screen to clear itself.
   *
   * The POST is ours rather than the module's `clear()` because it also
   * revokes the token upstream. `clear()` follows, so the module's own state
   * does not outlive the cookie.
   */
  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      await clear().catch(() => {})
      if (import.meta.client) window.location.href = '/login'
    }
  }

  async function login(email: string, password: string) {
    const res = await $fetch<{ user: NonNullable<typeof user.value> }>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    // re-read rather than trusting the reply, so `loggedIn` and the cookie
    // cannot disagree
    await fetch()
    return res.user
  }

  return {
    user,
    /** False until the session has been read; not the same as signed out. */
    ready,
    isSignedIn: loggedIn,
    /** Whether the signed-in user holds a permission, e.g. `products.update`. */
    can: (permission: string) => hasPermission(user.value, permission),
    fetchUser: fetch,
    login,
    logout
  }
}
