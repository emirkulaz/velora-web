import type {
  Customer,
  FinanceTransaction,
  InventoryItem,
  MenuId,
  MenuItem,
  Order,
  Product,
  ProductionOrder,
} from './types'

export type { Customer, FinanceTransaction, InventoryItem, MenuId, MenuItem, Order, Product, ProductionOrder }

export const menuItems: MenuItem[] = [
  { id: 'overview', label: 'Genel Bakış', icon: 'grid' },
  { id: 'dailyWork', label: 'Günlük İşler', icon: 'grid' },
  { id: 'customers', label: 'Müşteriler', icon: 'users' },
  { id: 'customerRequests', label: 'Müşteri Talepleri', icon: 'users' },
  { id: 'products', label: 'Ürünler', icon: 'box' },
  { id: 'orders', label: 'Siparişler', icon: 'cart' },
  { id: 'inventory', label: 'Stok', icon: 'warehouse' },
  { id: 'production', label: 'Üretim', icon: 'factory' },
  { id: 'costCalculation', label: 'Maliyet Hesaplama', icon: 'calculator' },
  { id: 'finance', label: 'Finans', icon: 'chart' },
  { id: 'financeAi', label: 'Finans Asistanı', icon: 'spark' },
  { id: 'users', label: 'Ekip', icon: 'users' },
]

export const menuTitles: Record<MenuId, string> = {
  overview: 'Genel Bakış',
  dailyWork: 'Günlük İşler',
  customers: 'Müşteriler',
  customerRequests: 'Müşteri Talepleri',
  products: 'Ürünler',
  orders: 'Siparişler',
  inventory: 'Stok',
  production: 'Üretim',
  costCalculation: 'Maliyet Hesaplama',
  finance: 'Finans',
  financeAi: 'Finans Asistanı',
  users: 'Ekip, maaş ve izin',
}

/** Placeholder stats — gerçek API bağlanana kadar sıfır. */
export const stats = [
  { label: 'Toplam Satış', value: '0', unit: 'DZD', change: '—', trend: 'up' as const, icon: 'sales' },
  { label: 'Aktif Sipariş', value: '0', unit: 'adet', change: '—', trend: 'up' as const, icon: 'orders' },
  { label: 'Stok Uyarısı', value: '0', unit: 'ürün', change: '—', trend: 'down' as const, icon: 'alert' },
  { label: 'Üretim Durumu', value: '0', unit: '%', change: '—', trend: 'up' as const, icon: 'production' },
]

export const recentOrders: Order[] = []
export const allOrders: Order[] = []
export const productionLines: Array<{
  name: string
  progress: number
  status: string
  output: string
  shift: string
  workers: number
  target: string
}> = []
export const productionOrders: ProductionOrder[] = []
export const customers: Customer[] = []
export const products: Product[] = []
export const productCategories = ['Tümü']
export const inventory: InventoryItem[] = []
export const financeSummary = [
  { label: 'Tahsilatlar', value: '0', unit: 'DZD' },
  { label: 'Ödemeler', value: '0', unit: 'DZD' },
  { label: 'Alacaklar', value: '0', unit: 'DZD' },
  { label: 'Geciken Ödeme', value: '0', unit: 'DZD' },
]
export const financeTransactions: FinanceTransaction[] = []
export const overduePayments: Array<{
  customer: string
  amount: string
  dueDate: string
  daysLate: number
}> = []

export const orderStatusFilters = ['Tümü', 'Onay Bekliyor', 'Üretimde', 'Sevk Edildi', 'Tamamlandı']

export const CRITICAL_ALERTS: Array<{ id: string; text: string; action: string }> = []

export const QUICK_COMMANDS = [
  'Kasadaki toplam bakiye nedir?',
  'Son 5 kasa hareketini özetle.',
  'Bakiyesi en yüksek müşterileri göster.',
  'Stoku azalan ürünleri göster.',
  'Bugünkü üretimi özetle.',
] as const

export function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase().trim())
}
