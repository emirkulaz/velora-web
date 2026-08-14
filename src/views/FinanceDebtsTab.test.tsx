import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiPost: vi.fn(),
}))

import { FinanceDebtsTab } from './FinanceDebtsTab'

describe('FinanceDebtsTab localization', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/cash/summary') return Promise.resolve({ accounts: [] })
      if (path.startsWith('/supplier-debts')) {
        return Promise.resolve({
          currency: 'DZD',
          kpis: { totalOpenDebt: 118406, dueThisWeek: 0, overdue: 18406, paidThisMonth: 20000 },
          items: [{
            supplierId: 7,
            supplierName: 'Atlas Supplier',
            currency: 'DZD',
            debtType: 'PURCHASE',
            totalDebt: 150000,
            paid: 31594,
            remaining: 118406,
            dueDate: '2026-08-20',
            status: 'OPEN',
            lastMovementAt: '2026-08-13T10:00:00.000Z',
          }],
        })
      }
      return Promise.resolve([])
    })
  })

  it('renders localized debt status and DZD values without raw status codes', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')
    render(<I18nProvider><FinanceDebtsTab /></I18nProvider>)

    expect(await screen.findByText('Atlas Supplier')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Payables' })).toBeInTheDocument()
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/118,406(?:\.00)? DZD/).length).toBeGreaterThan(0)
    expect(screen.queryByText('OPEN')).not.toBeInTheDocument()
  })
})
