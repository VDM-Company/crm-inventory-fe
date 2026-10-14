import { isGuardedApiPath } from '#shared/utils/auth'

/**
 * No session, no API.
 *
 * This is what closes the hole the old `cors: true` rule left: `/api/*` used
 * to be an unauthenticated proxy holding a privileged credential, which any
 * other site's JavaScript could drive from a visitor's browser. Now every
 * route needs a session cookie, and that cookie is `sameSite: 'lax'`.
 *
 * Page routes are deliberately NOT guarded here. A logged-out visitor still
 * has to receive the login page and the JavaScript that renders it; the
 * pages guard themselves in `app/middleware/auth.global.ts`.
 */
export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!isGuardedApiPath(path)) return

  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'unauthenticated',
      data: { message: 'Sign in to continue.' }
    })
  }
})
