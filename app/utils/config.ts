import type { ConfigGroup, ConfigValues } from '~/types'

// The field groups the platform Configuration form renders, and the blank it
// starts from.
//
// Reads and writes go through `useApiPlatforms().settings` / `saveSettings`,
// which speak the API's grouped shape; `shared/utils/platform-settings.ts`
// maps between that and the flat keys below.

export const CONFIG_GROUPS: ConfigGroup[] = [
  { group: 'store', title: 'Store Information', icon: 'store', fields: [
    { key: 'storeName', label: 'Store Name', type: 'text', placeholder: 'e.g. Vertex Digital Marketing' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: 'e.g. +81 3-1234-5678' },
    { key: 'address', label: 'Address', type: 'textarea', placeholder: 'Street, city, postal code' }
  ] },
  { group: 'web', title: 'Web', icon: 'globe', fields: [
    { key: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'e.g. vdm.com', synced: true }
  ] },
  { group: 'contact', title: 'General Contact', icon: 'mail', fields: [
    { key: 'senderName', label: 'Sender Name', type: 'text', placeholder: 'e.g. VDM Support' },
    { key: 'senderEmail', label: 'Sender Email', type: 'text', placeholder: 'e.g. no-reply@vdm.com' }
  ] },
  { group: 'contactus', title: 'Contact Us', icon: 'message-circle', fields: [
    { key: 'contactEnabled', label: 'Enable Contact Us', type: 'toggle' },
    { key: 'contactEmail', label: 'Send Emails To', type: 'text', placeholder: 'e.g. support@vdm.com' }
  ] }
]

/**
 * An unfilled configuration form.
 *
 * It lived in `shared/seeds/` and was called a seed, which it never was —
 * every value is blank. The real seeds beside it held invented store names,
 * phone numbers and addresses for three platforms; they went when the last
 * thing reading them did. Spread it, never bind it, so a form cannot write
 * through to the constant.
 */
export const EMPTY_CONFIG: ConfigValues = {
  storeName: '',
  phone: '',
  address: '',
  senderName: '',
  senderEmail: '',
  contactEnabled: true,
  contactEmail: ''
}
