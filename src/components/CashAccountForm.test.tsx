import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiPost } from '../data/api'
import { CashAccountForm } from './CashAccountForm'
vi.mock('../data/api', () => ({ apiPost: vi.fn() }))
afterEach(cleanup)
beforeEach(()=>vi.resetAllMocks())
it('opens a separate account only on explicit submission and sends no opening balance',async()=>{
  vi.mocked(apiPost).mockResolvedValue({id:7}); const onCreated=vi.fn()
  render(<CashAccountForm onCreated={onCreated} />)
  expect(apiPost).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Hesap adı'),{target:{value:'Banka'}})
  fireEvent.change(screen.getByLabelText('Hesap kodu'),{target:{value:'BANK-1'}})
  fireEvent.click(screen.getByRole('button',{name:'Hesabı aç'}))
  await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/cash-accounts',{name:'Banka',code:'BANK-1'}))
  expect(onCreated).toHaveBeenCalledTimes(1)
  expect(await screen.findByText('Hesap açıldı; para hareketi oluşturulmadı.')).toBeInTheDocument()
})
it('preserves fields and shows an actionable server error',async()=>{
  vi.mocked(apiPost).mockRejectedValue(new Error('Bu hesap kodu zaten kullanılıyor.'))
  render(<CashAccountForm onCreated={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Hesap adı'),{target:{value:'Banka'}})
  fireEvent.change(screen.getByLabelText('Hesap kodu'),{target:{value:'BANK'}})
  fireEvent.click(screen.getByRole('button',{name:'Hesabı aç'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('zaten kullanılıyor')
  expect(screen.getByLabelText('Hesap adı')).toHaveValue('Banka')
})
