import type { ConfigValues } from '../types/domain'

export const PLATFORM_CONFIG_SEED: Record<string, ConfigValues> = {
  p_general: { storeName: 'Vertex Digital Marketing', phone: '+81 3-1234-5678', address: '1-2-3 Shibuya, Tokyo 150-0002', senderName: 'VDM Support', senderEmail: 'no-reply@vdm.com', contactEnabled: true, contactEmail: 'support@vdm.com' },
  p_sp: { storeName: 'SIM Point', phone: '+81 3-2345-6789', address: '4-5-6 Shinjuku, Tokyo 160-0022', senderName: 'SIM Point Support', senderEmail: 'no-reply@sim-point.jp', contactEnabled: true, contactEmail: 'support@sim-point.jp' },
  p_sk: { storeName: 'SK-SIM', phone: '+81 3-3456-7890', address: '7-8-9 Shibuya, Tokyo 150-0001', senderName: 'SK-SIM Support', senderEmail: 'no-reply@sk-sim.jp', contactEnabled: true, contactEmail: 'support@sk-sim.jp' }
}

export const GENERIC_CONFIG_SEED: ConfigValues = {
  storeName: '',
  phone: '',
  address: '',
  senderName: '',
  senderEmail: '',
  contactEnabled: true,
  contactEmail: ''
}
