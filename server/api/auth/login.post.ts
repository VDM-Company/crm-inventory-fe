import type { LoginResult } from '#shared/types'
import { vertexLoginSchema } from '#shared/schemas'
import { toSessionUser } from '#shared/utils/auth'

/**
 * Exchanges credentials for a session.
 *
 * The token the API answers with stops here. It goes under `secure`, which
 * `nuxt-auth-utils` strips before the session is ever sent to the browser;
 * what the client gets back is a name, an email and a permission list.
 *
 * Called with no bearer of its own — there is no session yet, which is the
 * point.
 *
 * `replaceUserSession`, not `setUserSession`: the latter merges with defu, so
 * signing in as someone else would keep whatever the previous session held.
 */
export default defineEventHandler(async (event) => {
  const body = await parseBody(event, vertexLoginSchema)

  const result = await vertex(event, { token: '' })
    .one<LoginResult>('/admin/auth/login', { method: 'POST', body })

  const user = toSessionUser(result.user)
  await replaceUserSession(event, { user, secure: { token: result.token } })
  return { user }
})
