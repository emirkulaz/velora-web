import type { MenuId } from './types'

export type AppUserRole =
  | 'ADMIN'
  | 'MEMBER'
  | 'VIEWER'
  | 'ACCOUNTING_OPERATOR'
  | 'ACCOUNTING_OPERATIONS'
  | 'OWNER'
  | 'PRODUCTION_MANAGER'

export const roleLabels: Record<AppUserRole, string> = {
  ADMIN: 'Yönetici',
  MEMBER: 'Çalışan',
  VIEWER: 'Görüntüleyici',
  ACCOUNTING_OPERATOR: 'Muhasebe Operatörü',
  ACCOUNTING_OPERATIONS: 'Muhasebe & Operasyon',
  OWNER: 'Şirket Sahibi',
  PRODUCTION_MANAGER: 'Üretim Müdürü',
}

const ALL_MENUS: MenuId[] = [
  'overview',
  'dailyWork',
  'customers',
  'customerRequests',
  'products',
  'orders',
  'inventory',
  'yarnInventory',
  'production',
  'costCalculation',
  'finance',
  'financeAi',
  'users',
]

const ACCOUNTING_MENUS: MenuId[] = [
  'overview',
  'dailyWork',
  'customers',
  'customerRequests',
  'orders',
  'inventory',
  'yarnInventory',
  'finance',
  'financeAi',
]

const ORDER_WRITE_ROLES: AppUserRole[] = [
  'ADMIN',
  'OWNER',
  'ACCOUNTING_OPERATIONS',
  'ACCOUNTING_OPERATOR',
]

const REQUEST_WRITE_ROLES: AppUserRole[] = [...ORDER_WRITE_ROLES]

const ROLE_MENUS: Record<AppUserRole, MenuId[]> = {
  OWNER: ALL_MENUS,
  ADMIN: ALL_MENUS,
  MEMBER: ALL_MENUS.filter((id) => id !== 'users' && id !== 'dailyWork'),
  VIEWER: ALL_MENUS.filter((id) => id !== 'users' && id !== 'dailyWork'),
  ACCOUNTING_OPERATOR: ACCOUNTING_MENUS,
  ACCOUNTING_OPERATIONS: ACCOUNTING_MENUS,
  PRODUCTION_MANAGER: [
    'overview',
    'products',
    'inventory',
    'yarnInventory',
    'production',
    'costCalculation',
    'orders',
  ],
}

export function menusForRole(role: AppUserRole | null | undefined): MenuId[] {
  if (!role) return ALL_MENUS
  return ROLE_MENUS[role] ?? ALL_MENUS.filter((id) => id !== 'users')
}

export function canAccessMenu(
  role: AppUserRole | null | undefined,
  menuId: MenuId,
): boolean {
  return menusForRole(role).includes(menuId)
}

export function canWriteOrders(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return ORDER_WRITE_ROLES.includes(role)
}

export function canWriteCustomerRequests(
  role: AppUserRole | null | undefined,
): boolean {
  if (!role) return false
  return REQUEST_WRITE_ROLES.includes(role)
}

const OPERATIONAL_WRITE_ROLES: AppUserRole[] = [
  'ADMIN',
  'OWNER',
  'MEMBER',
]

const STOCK_WRITE_ROLES: AppUserRole[] = [
  'ADMIN',
  'OWNER',
  'MEMBER',
  'PRODUCTION_MANAGER',
  'ACCOUNTING_OPERATOR',
  'ACCOUNTING_OPERATIONS',
]

const FINANCE_WRITE_ROLES: AppUserRole[] = [
  'ADMIN',
  'OWNER',
  'ACCOUNTING_OPERATOR',
  'ACCOUNTING_OPERATIONS',
]

const PRODUCTION_WRITE_ROLES: AppUserRole[] = [
  'ADMIN',
  'OWNER',
  'MEMBER',
  'PRODUCTION_MANAGER',
]

const COMPANY_ADMIN_ROLES: AppUserRole[] = ['ADMIN', 'OWNER']

export function canWriteCustomers(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return OPERATIONAL_WRITE_ROLES.includes(role)
}

export function canDeleteCustomers(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return COMPANY_ADMIN_ROLES.includes(role)
}

export function canWriteProducts(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return OPERATIONAL_WRITE_ROLES.includes(role)
}

export function canDeleteProducts(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return COMPANY_ADMIN_ROLES.includes(role)
}

export function canWriteStock(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return STOCK_WRITE_ROLES.includes(role)
}

export function canWriteFinance(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return FINANCE_WRITE_ROLES.includes(role)
}

export function canWriteProduction(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return PRODUCTION_WRITE_ROLES.includes(role)
}
