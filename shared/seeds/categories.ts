import type { Category } from '../types/domain'

export const CATEGORY_SEED: Category[] = [
  { id: 'c_sim', name: 'SIM Cards', parentId: null, enabled: true },
  { id: 'c_sim_tour', name: 'Tourist SIM', parentId: 'c_sim', enabled: true },
  { id: 'c_sim_res', name: 'Resident SIM', parentId: 'c_sim', enabled: true },
  { id: 'c_sim_esim', name: 'eSIM', parentId: 'c_sim', enabled: true },
  { id: 'c_dev', name: 'Devices', parentId: null, enabled: true },
  { id: 'c_dev_rout', name: 'Router', parentId: 'c_dev', enabled: true },
  { id: 'c_dev_dong', name: 'Dongle', parentId: 'c_dev', enabled: true },
  { id: 'c_data', name: 'Data Plan', parentId: null, enabled: true },
  { id: 'c_data_pre', name: 'Prepaid Data', parentId: 'c_data', enabled: true },
  { id: 'c_data_unl', name: 'Unlimited Data', parentId: 'c_data', enabled: true },
  { id: 'c_wifi', name: 'WiFi', parentId: null, enabled: true },
  { id: 'c_wifi_pkt', name: 'Pocket WiFi', parentId: 'c_wifi', enabled: true },
  { id: 'c_wifi_home', name: 'Home Router', parentId: 'c_wifi', enabled: true },
  { id: 'c_head', name: 'Headphones', parentId: null, enabled: true },
  { id: 'c_acc', name: 'Accessories', parentId: null, enabled: true },
  { id: 'c_acc_chg', name: 'Chargers', parentId: 'c_acc', enabled: true },
  { id: 'c_acc_case', name: 'Cases', parentId: 'c_acc', enabled: true }
]
