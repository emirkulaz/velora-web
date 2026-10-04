import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { StrictMode } from 'react'

const { apiGet, apiPost, apiRequest } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn(), apiRequest: vi.fn() }))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
  apiPost,
  apiRequest,
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
  afterEach(cleanup)
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiPost.mockReset().mockResolvedValue({created:true})
    apiRequest.mockReset().mockResolvedValue(order)
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/orders') return Promise.resolve([order])
      if (path === '/customers') return Promise.resolve([{ id: 1, name: order.customerName }])
      if (path === '/products') return Promise.resolve([{id:2,code:'STRIP',name:'Şerit',unit:'METER',salePrice:12.5},{id:3,code:'COLLAR',name:'Yaka',unit:'PIECE',salePrice:20}])
      if (path === '/cash-accounts') return Promise.resolve([{id:7,name:'Banka',currency:'DZD',isActive:true}])
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
    expect(screen.getByText(/14\/08\/2026/)).toBeInTheDocument()
    expect(screen.getByText('50,000 DZD')).toBeInTheDocument()
    expect(screen.queryByText('PARTIALLY_DELIVERED')).not.toBeInTheDocument()
  })
  it('requires a receipt account and submits a bank collection only to the chosen account',async()=>{
    render(<I18nProvider><OrdersModule canWrite /></I18nProvider>)
    fireEvent.click(await screen.findByText('SO-2026-11'))
    const accountFields=await screen.findAllByLabelText('Tahsilat / avans hesabı')
    expect(accountFields[0]).toHaveValue('')
    const form=accountFields[0].closest('form')!
    fireEvent.change(within(form).getByRole('spinbutton'),{target:{value:'1000'}})
    fireEvent.submit(form)
    expect(apiPost).not.toHaveBeenCalled()
    fireEvent.change(accountFields[0],{target:{value:'7'}})
    fireEvent.change(within(form).getByLabelText('Ödeme yöntemi'),{target:{value:'BANK'}})
    fireEvent.submit(form)
    await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/orders/11/collections',expect.objectContaining({amount:1000,cashAccountId:7,paymentMethod:'BANK',postToCash:true})))
  })
  it('creates a strip order with live pricing and keeps input after a failed save',async()=>{
    render(<I18nProvider><OrdersModule canWrite /></I18nProvider>)
    await screen.findByText('SO-2026-11')
    fireEvent.click(screen.getByRole('button',{name:/Yeni sipariş/i}))
    const dialog=screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Müşteri'),{target:{value:'1'}})
    fireEvent.change(within(dialog).getByLabelText('Ürün'),{target:{value:'2'}})
    expect(within(dialog).getByLabelText('Birim')).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText(/Miktar/),{target:{value:'400'}})
    expect(within(dialog).getAllByText('5.000 DZD')).toHaveLength(2)
    expect(within(dialog).getByLabelText(/DA\/Metre/i)).toHaveValue(12.5)
    apiRequest.mockRejectedValueOnce(new Error('offline'))
    fireEvent.submit(dialog.querySelector('form')!)
    await within(dialog).findByRole('alert')
    expect(within(dialog).getByLabelText(/Miktar/)).toHaveValue(400)
    expect(within(dialog).getByLabelText('Müşteri')).toHaveValue('1')
    fireEvent.submit(dialog.querySelector('form')!)
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const payload=JSON.parse(apiRequest.mock.calls.at(-1)![1].body)
    expect(payload).toMatchObject({customerId:1,productId:2,quantity:400,unit:'METER',unitPrice:12.5,advanceAmount:0})
  })
  it('uses pieces and per-piece prices when a collar is selected',async()=>{
    render(<I18nProvider><OrdersModule canWrite /></I18nProvider>)
    await screen.findByText('SO-2026-11');fireEvent.click(screen.getByRole('button',{name:/Yeni sipariş/i}))
    const dialog=screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Ürün'),{target:{value:'3'}})
    expect(within(dialog).getByLabelText(/DA\/Adet/i)).toHaveValue(20)
    expect(within(dialog).getByLabelText(/Miktar.*Adet/i)).toBeInTheDocument()
  })
  it('opens the home shortcut even when React replays mount effects',async()=>{
    sessionStorage.setItem('velora.orders.openCreate','1')
    render(<StrictMode><I18nProvider><OrdersModule canWrite /></I18nProvider></StrictMode>)
    expect(await screen.findByRole('dialog',{name:'Yeni Sipariş'})).toBeInTheDocument()
  })
})

