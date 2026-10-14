import type { AdminUser } from '#shared/types'

/**
 * The pure half of authentication.
 *
 * Both decisions here are ones that are easy to get subtly wrong and
 * impossible to notice afterwards — an API path that is public when it should
 * not be, and a redirect that leaves the site. They live here so they are
 * tested directly rather than through a middleware.
 */

/**
 * The only `/api` paths reachable without a session.
 *
 * Exact matches, deliberately. A `startsWith` check would make
 * `/api/auth/login-as-anyone` public too, and the whole point of the guard is
 * that the list of exceptions cannot grow by accident.
 */
const PUBLIC_API_PATHS = new Set([
  '/api/auth/login',
  '/api/_health'
])

/**
 * Whether this request needs a session.
 *
 * Only `/api` is guarded. Page routes and `/_nuxt` assets are not: the pages
 * guard themselves, and a logged-out visitor still has to be served the login
 * page and the JavaScript that renders it.
 */
export function isGuardedApiPath(pathname: string): boolean {
  const path = (pathname || '').split('?')[0] || ''
  if (!path.startsWith('/api/')) return false
  // trailing slashes are the same route to the router, so they are to us
  const normalized = path.length > 5 && path.endsWith('/') ? path.slice(0, -1) : path
  return !PUBLIC_API_PATHS.has(normalized)
}

/**
 * A `?redirect=` value that is safe to send a browser to.
 *
 * Anything that is not a path on this site becomes the dashboard. The cases
 * that matter are `//evil.test` and `https://evil.test`, which a browser
 * treats as another origin — a login form that honours either is an open
 * redirect, and it is the login form that makes it worth phishing.
 *
 * `/\` is refused as well: some browsers normalise the backslash to `/`,
 * which makes it the `//` case wearing a different hat.
 */
export function safeRedirect(value: unknown, fallback = '/dashboard'): string {
  if (typeof value !== 'string') return fallback
  const path = value.trim()
  if (!path.startsWith('/')) return fallback
  if (path.startsWith('//') || path.startsWith('/\\')) return fallback
  // a login page that redirects to itself would bounce forever
  if (path === '/login' || path.startsWith('/login?')) return fallback
  return path
}

/** What the app keeps about whoever is signed in. */
export interface SessionUser {
  id: string
  name: string
  email: string
  roles: string[]
  permissions: string[]
}

/**
 * The API's user document as the app holds it.
 *
 * Roles arrive as records and are flattened to their names: nothing on screen
 * needs a role's id, and `permissions` is what any check should read anyway —
 * a role is a bundle of them, so asking "is this user super_admin" rather than
 * "may this user do X" goes stale the moment the bundle changes.
 */
export function toSessionUser(user: AdminUser): SessionUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: (user.roles || []).map(r => r.name),
    permissions: [...(user.permissions || [])]
  }
}

/** Whether the user holds this permission. No user means no. */
export const can = (user: SessionUser | null | undefined, permission: string): boolean =>
  !!user && user.permissions.includes(permission)
