import type { ConfigValues, VertexPlatformSettings } from '#shared/types'

/**
 * Between the flat config the platform form renders and the grouped settings
 * the API stores.
 *
 * The form was built against a flat record — `storeName`, `senderEmail`,
 * `contactEnabled` — and the API groups them under `store`, `mail` and
 * `contact`. Mapping here keeps the form, and the component shared by Create
 * and Edit, exactly as they were: the shape change is the API's, not the
 * screen's.
 *
 * `baseUrl` is deliberately absent from both directions. It used to be a
 * config value; upstream it is the platform's own `domain` field, so the page
 * reads and writes it with the identity fields and the form shows it locked.
 */
export function settingsToConfigValues(s: VertexPlatformSettings | null | undefined): ConfigValues {
  return {
    storeName: s?.store?.name ?? '',
    phone: s?.store?.phone ?? '',
    address: s?.store?.address ?? '',
    senderName: s?.mail?.senderName ?? '',
    senderEmail: s?.mail?.senderEmail ?? '',
    contactEnabled: s?.contact?.enabled ?? false,
    contactEmail: s?.contact?.recipientEmail ?? ''
  }
}

/**
 * The reverse, for `PUT :id/settings` — which is a FULL REPLACE, so every
 * group is sent even when empty. Leaving one out clears it upstream.
 */
export function configValuesToSettings(c: ConfigValues): Omit<VertexPlatformSettings, 'lockVersion'> {
  const str = (v: unknown) => typeof v === 'string' ? v.trim() : ''
  return {
    store: { name: str(c.storeName), phone: str(c.phone), address: str(c.address) },
    mail: { senderName: str(c.senderName), senderEmail: str(c.senderEmail) },
    contact: { enabled: c.contactEnabled === true, recipientEmail: str(c.contactEmail) }
  }
}
