import type { LoginResult } from '#shared/types'
import { vertexLoginSchema } from '#shared/schemas'
import { toSessionUser } from '#shared/utils/auth'

/**
 * Exchanges credentials for a session.
 *
 * The token the API answers with stops here: it goes into the sealed cookie
 * and the browser is told only who it is signed in as. Nothing in the
 * response body is the token.
 *
 * Called with no bearer of its own — there is no session yet, which is the
 * point.
 */
export default defineEventHandler(async (event) => {
  const body = await parseBody(event, vertexLoginSchema)

  const result = await vertex(event, { token: '' })
    .one<LoginResult>('/admin/auth/login', { method: 'POST', body })

  const user = toSessionUser(result.user)
  await startSession(event, result.token, user)
  return { user }
})
