import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { OrderOverview } from './OrderOverview'
const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../data/api', () => ({ apiGet, apiPatch: vi.fn() }))
const base = {
  id: 1, orderNumber: 'SIP-001', customerName: 'Ali', productName: 'Yaka', quantity: 500,
  unit: 'PIECE', unitPrice: 100, grossTotal: 50000, currency: 'DZD', status: 'CONFIRMED',
  orderDate: '2026-09-14T10:00:00Z', expectedDeliveryDate: '2026-09-13', deliveredQuantity: 0, notes: null,
}
beforeEach(() => {
  localStorage.clear(); localStorage.setItem('velora.uiLanguage', 'tr')
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-14T12:00:00Z'))
  apiGet.mockReset().mockResolvedValue([base])
})
afterEach(() => { cleanup(); vi.useRealTimers() })
function show() { return render(<I18nProvider><OrderOverview /></I18nProvider>) }
function card(name: string) { return screen.getByRole('heading', { name }).closest('article')! }
describe('home order summary', () => {
  it('shows actual quantity, unit price, total and late delivery warning', async () => {
    show(); await screen.findByRole('heading', { name: 'Yaka' })
    expect(within(card('Yaka')).getByText('500 adet')).toBeInTheDocument()
    expect(within(card('Yaka')).getByText(/×.*100 DZD/)).toBeInTheDocument()
    expect(within(card('Yaka')).getByText('50.000 DZD')).toBeInTheDocument()
    expect(screen.getByText('Teslim tarihi geçti — teslimat tamamlanmadı')).toBeInTheDocument()
    expect(screen.getByText('Teslim edilecek: 500 adet')).toBeInTheDocument()
  })
  it('separates pending deliveries, drafts and completed or cancelled orders', async () => {
    apiGet.mockResolvedValue([
      { ...base, expectedDeliveryDate: '2026-09-15', deliveredQuantity: 200 },
      { ...base, id: 2, productName: 'Taslak ürün', status: 'DRAFT' },
      { ...base, id: 3, productName: 'İptal ürün', status: 'CANCELLED' },
      { ...base, id: 4, productName: 'Teslim ürün', status: 'DELIVERED', deliveredQuantity: 500 },
    ])
    show(); await screen.findByRole('heading', { name: 'Yaka' })
    expect(screen.getByText('Kısmi teslim edildi')).toBeInTheDocument()
    expect(screen.getByText('Teslim edilecek: 300 adet')).toBeInTheDocument()
    expect(screen.getByText('Taslak — onay bekliyor')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'İptal ürün' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Teslim ürün' })).not.toBeInTheDocument()
    expect(screen.queryByText(/siparişin teslim tarihi geçti/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tüm siparişler' }))
    expect(screen.getByRole('heading', { name: 'Teslim ürün' })).toBeInTheDocument()
  })
  it('filters today and searches by product', async () => {
    apiGet.mockResolvedValue([base, { ...base, id: 2, productName: 'Kumaş', orderDate: '2026-09-12', expectedDeliveryDate: null }])
    show(); await screen.findByRole('heading', { name: 'Kumaş' })
    await userEvent.click(screen.getByRole('button', { name: 'Bugün gelenler' }))
    expect(screen.queryByRole('heading', { name: 'Kumaş' })).not.toBeInTheDocument()
    await userEvent.type(screen.getByRole('searchbox'), 'yaka')
    expect(screen.getByRole('heading', { name: 'Yaka' })).toBeInTheDocument()
  })
  it('does not classify a delivery due today as overdue', async () => {
    apiGet.mockResolvedValue([{ ...base, expectedDeliveryDate: '2026-09-14' }])
    show(); await screen.findByRole('heading', { name: 'Yaka' })
    expect(screen.getByText('Henüz teslim edilmedi')).toBeInTheDocument()
    expect(screen.queryByText(/siparişin teslim tarihi geçti/)).not.toBeInTheDocument()
  })
  it('can recover from API failure using refresh', async () => {
    apiGet.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([base])
    show(); await screen.findByRole('alert')
    expect(screen.queryByRole('heading', { name: 'Yaka' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Yenile' }))
    await screen.findByRole('heading', { name: 'Yaka' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  it.each([['fr', 'Résumé des commandes'], ['ar', 'ملخص الطلبات']])('renders %s home text', async (language, title) => {
    localStorage.setItem('velora.uiLanguage', language)
    show(); await screen.findByRole('heading', { name: 'Yaka' })
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})
