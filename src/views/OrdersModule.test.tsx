import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
  apiRequest: vi.fn(),
}))

import { OrdersModule } from './OrdersModule'

const order = {
  id: 11,
  customerId: 1,
  customerName: 'Client Constantine',
  productId: 2,
  productName: 'Ruban',
  orderNumber: 'SO-2026-11',
  orderDate: '2026-08-14',
  expectedDeliveryDate: null,
  status: 'PARTIALLY_DELIVERED',
  widthCm: null,
  colorCount: null,
  quantity: 500,
  unit: 'METER',
  unitPrice: 100,
  grossTotal: 50000,
  advanceAmount: 10000,
  collectedAmount: 0,
  remainingAmount: 40000,
  currency: 'DZD',
  notes: null,
  deliveredQuantity: 100,
  deliveries: [],
}

describe('OrdersModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/orders') return Promise.resolve([order])
      if (path === '/customers') return Promise.resolve([{ id: 1, name: order.customerName }])
      if (path === '/products') return Promise.resolve([])
      return Promise.resolve(order)
    })
  })

  it('renders order enums, dates, and DZD values in the selected locale', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')

    render(
      <I18nProvider>
        <OrdersModule />
      </I18nProvider>,
    )

    expect(await screen.findByText('SO-2026-11')).toBeInTheDocument()
    expect(screen.getByText('Partially delivered')).toBeInTheDocument()
    expect(screen.getByText('14/08/2026')).toBeInTheDocument()
    expect(screen.getByText('50,000 DZD')).toBeInTheDocument()
    expect(screen.queryByText('PARTIALLY_DELIVERED')).not.toBeInTheDocument()
  })
})
