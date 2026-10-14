import type { VertexPlatform, VertexPlatformDraft, VertexPlatformPatch, VertexPlatformSettings } from '#shared/types'

/**
 * The platforms resource on the Vertex Commerce API.
 *
 * Two things the old shape did not have:
 *
 * - **No delete.** The API has no DELETE for a platform — it is switched off
 *   with `deactivate` and back on with `activate`, and carries `isActive`.
 *   The Platforms page currently offers a delete, which has nothing to call.
 * - **Settings are a full replace.** `saveSettings` sends every group; the API
 *   clears any it does not receive. It needs the `lockVersion` that came back
 *   from `settings()`, and reports errors keyed by setting
 *   (`contact.recipientEmail`), not by form field.
 */
export function useApiPlatforms() {
  const api = useVertexResource<VertexPlatform, VertexPlatformDraft, VertexPlatformPatch>('platforms')
  const base = '/api/platforms'
  const http = useApiFetch()

  return {
    ...api,
    /** `remove` exists on the factory but not on this API — do not offer it. */
    remove: undefined as never,

    activate: (id: string) => api.action(id, 'activate'),
    deactivate: (id: string) => api.action(id, 'deactivate'),

    settings: (id: string) => http<VertexPlatformSettings>(`${base}/${id}/settings`),

    /**
     * Drop this platform's own product order for one category, so it follows
     * the Default order again. The platform owns the override, which is why
     * this lives here rather than on the categories binding.
     */
    resetCategoryProductOrder: async (id: string, categoryId: string): Promise<void> => {
      await http(`${base}/${id}/categories/${categoryId}/products/reset`, { method: 'POST' })
    },

    /** Full replace: send every group, or the API clears the missing ones. */
    saveSettings: (id: string, settings: Omit<VertexPlatformSettings, 'lockVersion'>, lockVersion: number) =>
      http<VertexPlatformSettings>(`${base}/${id}/settings`, {
        method: 'PUT',
        body: { ...settings, lockVersion } as unknown as Record<string, unknown>
      })
  }
}
