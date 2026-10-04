import { loadAiEntryCatalog } from '../data/aiEntryCatalog'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AiEntryAssistant } from './AiEntryAssistant'
import { I18nProvider } from '../i18n/I18nProvider'
vi.mock('../data/aiEntryCatalog', () => ({ loadAiEntryCatalog: vi.fn() }))
beforeEach(() => vi.mocked(loadAiEntryCatalog).mockReset())
afterEach(cleanup)
it('validates fields and prepares an editable command without submitting it', () => {
  localStorage.setItem('velora.uiLanguage', 'tr')
  const onDraft = vi.fn()
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft onDraft={onDraft} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  const draft = screen.getByRole('button', { name: 'Sipariş taslağını komuta aktar' })
  expect(draft).toBeDisabled()
  for (const [label, value] of [['Müşteri', 'Ahmet Tekstil'], ['Ürün / ürün kodu', 'Şerit'], ['Miktar', '500'], ['Birim', 'metre'], ['Birim fiyat (DZD)', '12,5']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  expect(screen.getAllByText('6.250,00', { selector: 'dd' })).toHaveLength(3)
  expect(onDraft).not.toHaveBeenCalled()
  fireEvent.click(draft)
  expect(onDraft).toHaveBeenCalledWith(expect.stringContaining('Müşteri: Ahmet Tekstil'))
  expect(onDraft).toHaveBeenCalledWith(expect.stringContaining('onay göster'))
})
it('keeps order drafting hidden for roles without access', () => {
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft={false} onDraft={vi.fn()} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  expect(screen.queryByRole('button', { name: 'Sipariş taslağını komuta aktar' })).not.toBeInTheDocument()
})


it('includes every product, blocks incomplete lines and recalculates after removal', () => {
  const onDraft = vi.fn()
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft onDraft={onDraft} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  fireEvent.change(screen.getByLabelText('Müşteri'), { target: { value: 'Ahmet' } })
  for (const [label, value] of [['Ürün / ürün kodu', 'Pamuk'], ['Miktar', '2'], ['Birim', 'kg'], ['Birim fiyat (DZD)', '100']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Ürün ekle' }))
  const draft = screen.getByRole('button', { name: 'Sipariş taslağını komuta aktar' })
  expect(draft).toBeDisabled()
  for (const [label, value] of [['Ürün / ürün kodu', 'İplik'], ['Miktar', '3'], ['Birim', 'kg'], ['Birim fiyat (DZD)', '50']]) {
    fireEvent.change(screen.getAllByLabelText(label)[1], { target: { value } })
  }
  expect(screen.getAllByText('350,00', { selector: 'dd' })).toHaveLength(3)
  fireEvent.click(draft)
  expect(onDraft).toHaveBeenCalledWith(expect.stringContaining('İplik'))
  expect(onDraft).toHaveBeenCalledWith(expect.stringContaining('Pamuk'))
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  fireEvent.click(screen.getByRole('button', { name: 'Satırı sil 1' }))
  expect(screen.getAllByText('150,00', { selector: 'dd' })).toHaveLength(3)
  expect(screen.getByLabelText('Ürün / ürün kodu')).toHaveValue('İplik')
})

it('keeps the line limit separate from the 20000 character command limit', () => {
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft onDraft={vi.fn()} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  for (let i = 0; i < 9; i++) fireEvent.click(screen.getByRole('button', { name: 'Ürün ekle' }))
  expect(screen.getByRole('button', { name: 'Ürün ekle' })).toBeDisabled()
  expect(screen.queryByText(/Taslak komut sınırını aşıyor/)).not.toBeInTheDocument()
  expect(screen.getAllByLabelText('Ürün / ürün kodu')).toHaveLength(10)
  expect(screen.getByRole('button', { name: 'Sipariş taslağını komuta aktar' })).toBeDisabled()
})

it('loads saved data only on request and fills unit and price without creating records', async () => {
  const onDraft = vi.fn()
  vi.mocked(loadAiEntryCatalog).mockResolvedValue({ customers: [{ id: 7, name: 'Ahmet' }], products: [
    { id: 1, name: 'Şerit', code: 'S-1', unit: 'METER', salePrice: 12.5 },
    { id: 2, name: 'İplik', code: 'I-2', unit: 'KILOGRAM', salePrice: null },
    { id: 3, name: 'Numune', code: 'N-3', unit: 'PIECE', salePrice: 0 },
  ], loadedAt: '2026-10-01T10:00:00Z' })
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft onDraft={onDraft} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  expect(loadAiEntryCatalog).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Kayıtlı müşteri ve ürünleri getir' }))
  fireEvent.change(await screen.findByLabelText('Kayıtlı müşteri seç'), { target: { value: '7' } })
  expect(screen.getByLabelText('Müşteri')).toHaveValue('Ahmet (#7)')
  fireEvent.change(screen.getByLabelText('Kayıtlı ürün seç'), { target: { value: '1' } })
  expect(screen.getByLabelText('Ürün / ürün kodu')).toHaveValue('Şerit (S-1)')
  expect(screen.getByLabelText('Birim')).toHaveValue('metre')
  expect(screen.getByLabelText('Birim fiyat (DZD)')).toHaveValue('12.5')
  fireEvent.change(screen.getByLabelText('Kayıtlı ürün seç'), { target: { value: '2' } })
  expect(screen.getByLabelText('Birim')).toHaveValue('kg')
  expect(screen.getByLabelText('Birim fiyat (DZD)')).toHaveValue('')
  fireEvent.change(screen.getByLabelText('Kayıtlı ürün seç'), { target: { value: '3' } })
  expect(screen.getByLabelText('Birim fiyat (DZD)')).toHaveValue('0')
  expect(onDraft).not.toHaveBeenCalled()
})
it('shows a retryable catalog error while preserving manual inputs', async () => {
  vi.mocked(loadAiEntryCatalog).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ customers: [], products: [], loadedAt: '2026-10-01T10:00:00Z' })
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft onDraft={vi.fn()} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  fireEvent.change(screen.getByLabelText('Müşteri'), { target: { value: 'Taslak müşteri' } })
  fireEvent.click(screen.getByRole('button', { name: 'Kayıtlı müşteri ve ürünleri getir' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Kayıtlar yüklenemedi')
  expect(screen.getByLabelText('Müşteri')).toHaveValue('Taslak müşteri')
  fireEvent.click(screen.getByRole('button', { name: 'Kayıtlı müşteri ve ürünleri getir' }))
  expect(await screen.findByText('Kayıt bulunamadı; bilgileri elle girebilirsiniz.')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})


it('explains invalid numeric fields and clears errors after correction', () => {
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft onDraft={vi.fn()} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  const quantity = screen.getByLabelText('Miktar')
  fireEvent.blur(quantity)
  expect(quantity).toHaveAccessibleDescription('Bu alanı doldurun.')
  fireEvent.change(quantity, { target: { value: '0' } })
  expect(quantity).toHaveAttribute('aria-invalid', 'true')
  expect(quantity).toHaveAccessibleDescription('Miktar sıfırdan büyük olmalı.')
  fireEvent.change(quantity, { target: { value: '2,5' } })
  expect(quantity).toHaveAttribute('aria-invalid', 'false')
  fireEvent.change(screen.getByLabelText('Vergi (%)'), { target: { value: '101' } })
  expect(screen.getByLabelText('Vergi (%)')).toHaveAccessibleDescription('0 ile 100 arasında bir yüzde girin.')
})
it('duplicates independent lines and previews exactly the transferred command', () => {
  const onDraft = vi.fn()
  render(<I18nProvider><AiEntryAssistant disabled={false} canDraft onDraft={onDraft} /></I18nProvider>)
  fireEvent.click(screen.getByRole('button', { name: 'Veri gir ve hesapla' }))
  for (const [label, value] of [['Müşteri', 'Ahmet'], ['Ürün / ürün kodu', 'Pamuk'], ['Miktar', '2'], ['Birim', 'kg'], ['Birim fiyat (DZD)', '100']]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
  fireEvent.click(screen.getByRole('button', { name: 'Satırı kopyala 1' }))
  fireEvent.change(screen.getAllByLabelText('Miktar')[1], { target: { value: '3' } })
  expect(screen.getAllByLabelText('Miktar')[0]).toHaveValue('2')
  expect(screen.getAllByText('500,00', { selector: 'dd' })).toHaveLength(3)
  const command = screen.getByText(/Müşteri: Ahmet/, { selector: 'pre' }).textContent
  fireEvent.click(screen.getByRole('button', { name: 'Sipariş taslağını komuta aktar' }))
  expect(onDraft).toHaveBeenCalledWith(command)
})
