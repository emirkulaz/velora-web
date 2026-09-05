import type { MenuId, MenuItem } from './types'

export type { MenuId, MenuItem }

export interface MenuGroup {
  id: 'workspace' | 'operations' | 'finance' | 'management'
  labelKey: string
  items: MenuId[]
}

export const menuItems: MenuItem[] = [
  { id: 'overview', label: 'Genel Bakış', icon: 'grid' },
  { id: 'dailyWork', label: 'Günlük İşler', icon: 'grid' },
  { id: 'customers', label: 'Müşteriler', icon: 'users' },
  { id: 'customerRequests', label: 'Müşteri Talepleri', icon: 'users' },
  { id: 'products', label: 'Ürünler', icon: 'box' },
  { id: 'orders', label: 'Siparişler', icon: 'cart' },
  { id: 'inventory', label: 'Stok', icon: 'warehouse' },
  { id: 'yarnInventory', label: 'İplik Stoğu', icon: 'warehouse' },
  { id: 'production', label: 'Üretim', icon: 'factory' },
  { id: 'costCalculation', label: 'Maliyet Hesaplama', icon: 'calculator' },
  { id: 'finance', label: 'Finans', icon: 'chart' },
  { id: 'financeAi', label: 'Finans Asistanı', icon: 'spark' },
  { id: 'users', label: 'Çalışanlar', icon: 'users' },
  { id: 'userManagement', label: 'Kullanıcı Yönetimi', icon: 'users' },
]

export const menuGroups: MenuGroup[] = [
  {
    id: 'workspace',
    labelKey: 'nav.group.workspace',
    items: ['overview', 'dailyWork'],
  },
  {
    id: 'operations',
    labelKey: 'nav.group.operations',
    items: [
      'customers',
      'customerRequests',
      'products',
      'orders',
      'inventory',
      'yarnInventory',
      'production',
      'costCalculation',
    ],
  },
  {
    id: 'finance',
    labelKey: 'nav.group.finance',
    items: ['finance', 'financeAi'],
  },
  {
    id: 'management',
    labelKey: 'nav.group.management',
    items: ['users', 'userManagement'],
  },
]
