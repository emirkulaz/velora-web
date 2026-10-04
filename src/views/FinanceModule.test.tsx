import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { StrictMode } from 'react'

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiPost,
}))

import { FinanceModule } from './FinanceModule'

describe('FinanceModule localization', () => {
  afterEach(cleanup)
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiPost.mockReset().mockResolvedValue({created:true})
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
  it('records a collection in the selected account and preserves fields after a failure', async () => {
    const user=userEvent.setup()
    render(<I18nProvider><FinanceModule canWrite /></I18nProvider>)
    await screen.findByText('Customer collection')
    await user.click(screen.getByRole('button',{name:'+ Tahsilat'}))
    const dialog=screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Müşteri'),{target:{value:'2'}})
    fireEvent.change(within(dialog).getByRole('spinbutton'),{target:{value:'1000'}})
    fireEvent.change(within(dialog).getByLabelText('Açıklama'),{target:{value:'Kısmi tahsilat'}})
    fireEvent.submit(dialog.querySelector('form')!)
    expect(apiPost).not.toHaveBeenCalled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Paranın girip çıkacağı hesabı seçin.')
    fireEvent.change(within(dialog).getByLabelText('Tahsilat hesabı'),{target:{value:'1'}})
    apiPost.mockRejectedValueOnce(new Error('offline'))
    fireEvent.submit(dialog.querySelector('form')!)
    await waitFor(()=>expect(within(dialog).getByRole('alert')).not.toHaveTextContent('Paranın girip çıkacağı'))
    expect(within(dialog).getByRole('spinbutton')).toHaveValue(1000)
    expect(within(dialog).getByLabelText('Açıklama')).toHaveValue('Kısmi tahsilat')
    fireEvent.submit(dialog.querySelector('form')!)
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(apiPost).toHaveBeenLastCalledWith('/cash/collections',expect.objectContaining({customerId:2,amount:1000,cashAccountId:1}))
    expect(screen.getByText('1.000 DZD tahsilat Main cash hesabına kaydedildi.')).toBeInTheDocument()
  })
  it('opens a quick expense directly as money out and shows the account effect',async()=>{
    sessionStorage.setItem('velora.finance.openCash','1');sessionStorage.setItem('velora.finance.cashType','CASH_OUT')
    render(<StrictMode><I18nProvider><FinanceModule canWrite /></I18nProvider></StrictMode>)
    const dialog=await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Tip')).toHaveValue('CASH_OUT')
    fireEvent.change(within(dialog).getByRole('spinbutton'),{target:{value:'200'}})
    fireEvent.change(within(dialog).getByLabelText('Kategori'),{target:{value:'Diğer'}})
    fireEvent.change(within(dialog).getByLabelText('Açıklama'),{target:{value:'Küçük gider'}})
    fireEvent.change(within(dialog).getByLabelText('Ödeme hesabı'),{target:{value:'1'}})
    expect(within(dialog).getByRole('status')).toHaveTextContent('-200 DZD')
    fireEvent.submit(dialog.querySelector('form')!)
    await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/cash/transactions',expect.objectContaining({type:'CASH_OUT',amount:200,cashAccountId:1})))
  })
})

