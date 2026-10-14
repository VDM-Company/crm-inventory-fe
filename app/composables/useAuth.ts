import type { SessionUser } from '#shared/utils/auth'
import { can as hasPermission } from '#shared/utils/auth'

/**
 * Who is signed in, as the screens see it.
 *
 * There is no token here, and there is nothing to get one from. It lives in a
 * sealed httpOnly cookie that `server/api` reads; the browser only ever
 * learns the user's name, email and permissions.
 *
 * The user sits in `useState`, so the value the server rendered with hydrates
 * instead of being fetched a second time on the client.
 */
export function useAuth() {
  const user = useState<SessionUser | null>('auth:user', () => null)
  // null = not asked yet, which is different from "asked, and nobody"
  const loaded = useState<boolean>('auth:loaded', () => false)

  /**
   * Reads the session.
   *
   * `useRequestFetch` rather than `$fetch`: during SSR this runs on the
   * server, where a plain fetch carries none of the browser's cookies — so a
   * signed-in user would look signed out on every hard refresh and be bounced
   * to the login page.
   */
  async function fetchUser(force = false): Promise<SessionUser | null> {
    if (loaded.value && !force) return user.value
    try {
      const res = await useRequestFetch()<{ user: SessionUser | null }>('/api/auth/me')
      user.value = res.user
    } catch {
      user.value = null
    }
    loaded.value = true
    return user.value
  }

  async function login(email: string, password: string): Promise<SessionUser> {
    const res = await $fetch<{ user: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    user.value = res.user
    loaded.value = true
    return res.user
  }

  /**
   * Signs out, then sends the browser to the login page with a full reload.
   *
   * `window.location` rather than the router on purpose: it drops every piece
   * of the previous user's data still held in memory — `useState`, fetched
   * lists, open forms — rather than relying on each screen to clear itself.
   */
  async function logout() {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      user.value = null
      loaded.value = true
      if (import.meta.client) window.location.href = '/login'
    }
  }

  return {
    user,
    loaded,
    isSignedIn: computed(() => !!user.value),
    /** Whether the signed-in user holds a permission, e.g. `products.update`. */
    can: (permission: string) => hasPermission(user.value, permission),
    fetchUser,
    login,
    logout
  }
}
