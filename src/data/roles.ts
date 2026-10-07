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
  MEMBER: 'Operasyon kullanıcısı',
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
  'invoices',
  'financeAi',
  'users',
]

const ACCOUNTING_OPERATOR_MENUS: MenuId[] = [
  'overview',
  'customers',
  'finance',
  'financeAi',
]

// Muhasebe & Operasyon kullanıcısı bütün operasyonu görür;
// yönetimsel yazma izinleri yine her modülün kendi guard'ında sınırlıdır.
const ACCOUNTING_OPERATIONS_MENUS: MenuId[] = [...ALL_MENUS]

const ORDER_WRITE_ROLES: AppUserRole[] = [
  'ADMIN',
  'OWNER',
  'ACCOUNTING_OPERATIONS',
]

const REQUEST_WRITE_ROLES: AppUserRole[] = [...ORDER_WRITE_ROLES]

const ROLE_MENUS: Record<AppUserRole, MenuId[]> = {
  OWNER: ALL_MENUS,
  ADMIN: [...ALL_MENUS, 'userManagement'],
  MEMBER: ALL_MENUS.filter((id) => id !== 'users' && id !== 'dailyWork'),
  VIEWER: ALL_MENUS.filter((id) => id !== 'users' && id !== 'dailyWork'),
  ACCOUNTING_OPERATOR: ACCOUNTING_OPERATOR_MENUS,
  ACCOUNTING_OPERATIONS: ACCOUNTING_OPERATIONS_MENUS,
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

export function canManageUsers(role: AppUserRole | null | undefined): boolean {
  return role === 'ADMIN'
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

export function canWriteWorkforce(role: AppUserRole | null | undefined): boolean {
  if (!role) return false
  return (
    PRODUCTION_WRITE_ROLES.includes(role) || role === 'ACCOUNTING_OPERATIONS'
  )
}

/** AI örnek soru alanları — backend read role gruplarıyla hizalı. */
export type AiSuggestionDomain =
  | 'finance'
  | 'customers'
  | 'orders'
  | 'stock'
  | 'production'
  | 'workforce'
  | 'suppliers'
  | 'risks'

const AI_DOMAIN_ROLES: Record<AiSuggestionDomain, AppUserRole[]> = {
  finance: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'ACCOUNTING_OPERATOR',
    'ACCOUNTING_OPERATIONS',
  ],
  customers: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'ACCOUNTING_OPERATOR',
    'ACCOUNTING_OPERATIONS',
  ],
  orders: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'ACCOUNTING_OPERATOR',
    'ACCOUNTING_OPERATIONS',
    'PRODUCTION_MANAGER',
  ],
  stock: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'PRODUCTION_MANAGER',
    'ACCOUNTING_OPERATOR',
    'ACCOUNTING_OPERATIONS',
  ],
  production: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'PRODUCTION_MANAGER',
    'ACCOUNTING_OPERATIONS',
  ],
  workforce: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'PRODUCTION_MANAGER',
    'ACCOUNTING_OPERATIONS',
  ],
  suppliers: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'ACCOUNTING_OPERATOR',
    'ACCOUNTING_OPERATIONS',
    'PRODUCTION_MANAGER',
  ],
  risks: [
    'ADMIN',
    'OWNER',
    'MEMBER',
    'VIEWER',
    'ACCOUNTING_OPERATOR',
    'ACCOUNTING_OPERATIONS',
  ],
}

export function canAccessAiSuggestionDomain(
  role: AppUserRole | null | undefined,
  domain: AiSuggestionDomain,
): boolean {
  if (!role) return true
  return AI_DOMAIN_ROLES[domain].includes(role)
}
