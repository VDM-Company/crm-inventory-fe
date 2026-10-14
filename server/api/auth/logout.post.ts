/**
 * Ends the session.
 *
 * The local session is cleared whatever the upstream says. Revoking the token
 * there is the right thing to attempt, but a user who clicked Log out has to
 * end up logged out even when that call fails — and against the Postman mock
 * it always does, because its default saved example for this endpoint is the
 * 401.
 */
export default defineEventHandler(async (event) => {
  try {
    await vertex(event).none('/admin/auth/logout', { method: 'POST' })
  } catch {
    // best effort; the session below is what actually signs them out here
  }
  await clearUserSession(event)
  setResponseStatus(event, 204)
  return null
})
