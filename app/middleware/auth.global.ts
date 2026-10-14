import { safeRedirect } from '#shared/utils/auth'

/**
 * Every page needs a session, except the login page.
 *
 * It runs on the server too, which is why `fetchUser` goes through
 * `useRequestFetch` — otherwise the session cookie never reaches `/api/me`
 * during SSR and a signed-in user is bounced on every hard refresh.
 *
 * Where the visitor was heading is carried in `?redirect=`, and read back
 * through `safeRedirect`: a login form that forwards to wherever it is told
 * is an open redirect, and the login form is the one worth phishing.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { fetchUser } = useAuth()
  const user = await fetchUser()

  if (to.path === '/login') {
    // already signed in — no reason to show the form again
    return user ? navigateTo(safeRedirect(to.query.redirect)) : undefined
  }

  if (user) return

  return navigateTo({
    path: '/login',
    // `fullPath` keeps the query and hash, so a deep link survives the detour
    query: to.fullPath === '/' ? undefined : { redirect: to.fullPath }
  })
})
