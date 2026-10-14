import { safeRedirect } from '#shared/utils/auth'

/**
 * Every page needs a session, except the login page.
 *
 * `nuxt-auth-utils` fetches the session during SSR through its own plugin, so
 * unlike the hand-rolled version this no longer has to forward the cookie
 * itself — but it still has to wait for that to have happened, which is what
 * `ready` is for.
 *
 * Where the visitor was heading is carried in `?redirect=`, and read back
 * through `safeRedirect`: a login form that forwards wherever it is told is
 * an open redirect, and the login form is the one worth phishing.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { isSignedIn, ready, fetchUser } = useAuth()

  // on a hard refresh the session may not have been read yet
  if (!ready.value) await fetchUser()

  if (to.path === '/login') {
    // already signed in — no reason to show the form again
    return isSignedIn.value ? navigateTo(safeRedirect(to.query.redirect)) : undefined
  }

  if (isSignedIn.value) return

  return navigateTo({
    path: '/login',
    // `fullPath` keeps the query and hash, so a deep link survives the detour
    query: to.fullPath === '/' ? undefined : { redirect: to.fullPath }
  })
})
