export type MenuId =
  | 'overview'
  | 'customers'
  | 'products'
  | 'orders'
  | 'inventory'
  | 'production'
  | 'finance'
  | 'financeAi'
  | 'users'

export interface MenuItem {
  id: MenuId
  label: string
  icon: string
}

export interface Order {
  id: string
  customer: string
  product: string
  quantity: string
  amount: string
  status: string
  date: string
  notes?: string
}

export interface Customer {
  id: string
  name: string
  contact: string
  city: string
  phone: string
  orders: number
  balance: string
  status: string
}

export interface Product {
  sku: string
  name: string
  category: string
  price: string
  stock: string
  unit: string
  status: string
}

export interface InventoryItem {
  sku: string
  name: string
  warehouse: string
  quantity: string
  minimum: string
  unit: string
  status: string
}

export interface ProductionOrder {
  id: string
  product: string
  planned: number
  completed: number
  unit: string
  status: string
  progress: number
  delayed: boolean
  dueDate: string
}

export interface FinanceTransaction {
  id: string
  type: string
  party: string
  amount: string
  date: string
  status: string
}
