import type { MenuId } from './types'

export type AppUserRole =
  | 'ADMIN'
  | 'MEMBER'
  | 'VIEWER'
  | 'ACCOUNTING_OPERATOR'
  | 'OWNER'
  | 'PRODUCTION_MANAGER'

export const roleLabels: Record<AppUserRole, string> = {
  ADMIN: 'Yönetici',
  MEMBER: 'Çalışan',
  VIEWER: 'Görüntüleyici',
  ACCOUNTING_OPERATOR: 'Muhasebe Operatörü',
  OWNER: 'Şirket Sahibi',
  PRODUCTION_MANAGER: 'Üretim Müdürü',
}

const ALL_MENUS: MenuId[] = [
  'overview',
  'customers',
  'products',
  'orders',
  'inventory',
  'production',
  'finance',
  'financeAi',
  'users',
]

const ROLE_MENUS: Record<AppUserRole, MenuId[]> = {
  OWNER: ALL_MENUS,
  ADMIN: ALL_MENUS,
  MEMBER: ALL_MENUS.filter((id) => id !== 'users'),
  VIEWER: ALL_MENUS.filter((id) => id !== 'users'),
  ACCOUNTING_OPERATOR: ['overview', 'customers', 'finance', 'financeAi'],
  PRODUCTION_MANAGER: ['overview', 'products', 'inventory', 'production', 'orders'],
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
