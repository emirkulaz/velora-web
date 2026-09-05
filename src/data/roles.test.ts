import { describe, expect, it } from 'vitest'
import { canManageUsers, canWriteProduction, menusForRole } from './roles'

describe('ACCOUNTING_OPERATIONS görünürlüğü', () => {
  it('Asma gibi operasyon kullanıcısına tüm iş modüllerini gösterir, yönetici yetkisi vermez', () => {
    expect(menusForRole('ACCOUNTING_OPERATIONS')).toEqual(
      expect.arrayContaining([
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
      ]),
    )
    expect(canManageUsers('ACCOUNTING_OPERATIONS')).toBe(false)
    expect(canWriteProduction('ACCOUNTING_OPERATIONS')).toBe(false)
  })
})
