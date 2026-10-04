import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AiOrderContext } from './AiOrderContext'
import { I18nProvider } from '../i18n/I18nProvider'
import { loadAiOrderReferences } from '../data/aiOrderReferences'
vi.mock('../data/aiOrderReferences', () => ({ loadAiOrderReferences: vi.fn() }))
beforeEach(() => { localStorage.setItem('velora.uiLanguage', 'tr'); vi.mocked(loadAiOrderReferences).mockReset() })
afterEach(cleanup)
const orders = { orders: [{ id: 7, orderNumber: 'SO-20261001-7', customerName: 'Ahmet', productName: 'Şerit' }], loadedAt: '2026-10-01T10:00:00Z' }
it('loads on demand and drafts an exact order reference without submitting it', async () => {
  vi.mocked(loadAiOrderReferences).mockResolvedValue(orders)
  const onDraft = vi.fn()
  render(<I18nProvider><AiOrderContext disabled={false} canReadFinance onDraft={onDraft} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Siparişlerim üzerinden sor' }))
  expect(loadAiOrderReferences).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Siparişleri getir' }))
  fireEvent.change(await screen.findByLabelText('Sipariş seç'), { target: { value: '7' } })
  expect(onDraft).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Bu siparişin durumu nedir?' }))
  expect(onDraft).toHaveBeenCalledWith('Sipariş: SO-20261001-7. Bu siparişin durumu nedir?')
})
it('searches Turkish product names and hides finance questions without permission', async () => {
  vi.mocked(loadAiOrderReferences).mockResolvedValue(orders)
  render(<I18nProvider><AiOrderContext disabled={false} canReadFinance={false} onDraft={vi.fn()} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Siparişlerim üzerinden sor' }))
  fireEvent.click(screen.getByRole('button', { name: 'Siparişleri getir' }))
  const select = await screen.findByLabelText('Sipariş seç')
  fireEvent.change(screen.getByLabelText('Sipariş no, müşteri veya ürün ara'), { target: { value: 'serit' } })
  expect(screen.getByRole('option', { name: /SO-20261001-7/ })).toBeInTheDocument()
  fireEvent.change(select, { target: { value: '7' } })
  expect(screen.queryByRole('button', { name: /tahsil edilen/ })).not.toBeInTheDocument()
})
it('shows retry and clears obsolete choices after a failed reload', async () => {
  vi.mocked(loadAiOrderReferences).mockResolvedValueOnce(orders).mockRejectedValueOnce(new Error('offline'))
  render(<I18nProvider><AiOrderContext disabled={false} canReadFinance onDraft={vi.fn()} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Siparişlerim üzerinden sor' }))
  fireEvent.click(screen.getByRole('button', { name: 'Siparişleri getir' }))
  fireEvent.change(await screen.findByLabelText('Sipariş seç'), { target: { value: '7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Siparişleri getir' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Siparişler alınamadı')
  expect(screen.queryByRole('button', { name: 'Bu siparişin durumu nedir?' })).not.toBeInTheDocument()
})
