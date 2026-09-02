import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiPost: vi.fn(),
}))

import { FinanceModule } from './FinanceModule'

describe('FinanceModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/cash/transactions') {
        return Promise.resolve([
          {
            id: 1,
            transactionAt: '2026-08-13T10:00:00.000Z',
            description: 'Customer collection',
            debit: 49390,
            credit: 0,
            balance: 49390,
            cashAccount: { code: 'MAIN', name: 'Main cash', currency: 'DZD' },
          },
        ])
      }
      if (path === '/cash/summary') {
        return Promise.resolve({
          accounts: [{ id: 1, code: 'MAIN', name: 'Main cash', currency: 'DZD', balance: 49390 }],
        })
      }
      if (path === '/customer-ledger/summary') {
        return Promise.resolve({
          currency: 'DZD',
          totalReceivable: 1576610,
          totalAdvance: 0,
          customers: [{
            customerId: 2,
            customerName: 'Atlas Textile',
            currency: 'DZD',
            totalSales: 1600000,
            totalPayments: 23390,
            totalReturns: 0,
            balance: 1576610,
            transactionCount: 3,
            lastMovementAt: '2026-08-13T10:00:00.000Z',
            reviewRequired: true,
            source: 'IMPORT',
          }],
        })
      }
      if (path === '/customers') return Promise.resolve([{ id: 2, name: 'Atlas Textile' }])
      return Promise.resolve([])
    })
  })

  it('localizes finance data and conceals internal enum values', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')
    const user = userEvent.setup()

    render(
      <I18nProvider>
        <FinanceModule canWrite />
      </I18nProvider>,
    )

    expect(await screen.findByText('Customer collection')).toBeInTheDocument()
    expect(screen.getAllByText('49,390.00').length).toBeGreaterThan(0)
    expect(screen.getByText(/^13\/08\/2026/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Customer ledgers' }))
    expect(await screen.findByText('Review required')).toBeInTheDocument()
    expect(screen.queryByText('REVIEW_REQUIRED')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: '+ Cash movement' }))
    expect(screen.getByRole('option', { name: 'Cash in' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Cash out' })).toBeInTheDocument()
    expect(screen.queryByText('CASH_OUT')).not.toBeInTheDocument()
  })
})
