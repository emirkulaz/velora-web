import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../data/api'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiPublicPost } = vi.hoisted(() => ({ apiPublicPost: vi.fn() }))
vi.mock('../data/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/api')>()
  return { ...actual, apiPublicPost, apiGetWithToken: vi.fn() }
})

import { LoginScreen } from './LoginScreen'

describe('LoginScreen errors', () => {
  afterEach(cleanup)

  beforeEach(() => {
    localStorage.clear()
    apiPublicPost.mockReset()
  })

  it('shows a connection error instead of blaming the credentials', async () => {
    apiPublicPost.mockRejectedValue(new ApiError('Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.', 0))
    render(<I18nProvider><LoginScreen rememberedCompany={null} onAuthenticated={vi.fn()} /></I18nProvider>)

    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'owner' } })
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sunucuya ulaşılamıyor')
  })

  it('shows the API reason when valid credentials are blocked by policy', async () => {
    apiPublicPost.mockRejectedValue(new ApiError('Bu hesap için MFA kurulumu zorunludur.', 403))
    render(<I18nProvider><LoginScreen rememberedCompany={null} onAuthenticated={vi.fn()} /></I18nProvider>)

    fireEvent.change(screen.getByLabelText('E-posta'), { target: { value: 'owner' } })
    fireEvent.change(screen.getByLabelText('Şifre'), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('MFA kurulumu zorunludur')
  })
})
