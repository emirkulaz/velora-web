import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { canAccessAiSuggestionDomain } from '../data/roles'

const apiRequest = vi.fn()

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status = 400) {
      super(message)
      this.status = status
    }
  },
  apiDownload: vi.fn(),
  apiPost: vi.fn(),
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}))
vi.mock('../hooks/useSpeechToText', () => ({
  useSpeechToText: () => ({
    isListening: false,
    isSupported: false,
    error: '',
    start: vi.fn(),
    stop: vi.fn(),
  }),
}))

import { AiCommandPanel } from './AiCommandPanel'

describe('AiCommandPanel suggestions', () => {
  beforeEach(() => {
    localStorage.clear()
    apiRequest.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows localized example questions under the input', () => {
    localStorage.setItem('velora.uiLanguage', 'tr')
    render(
      <I18nProvider>
        <AiCommandPanel userName="Emir" userRole="OWNER" />
      </I18nProvider>,
    )

    expect(screen.getByRole('button', { name: 'Kasada ne kadar para var?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stok durumu nedir?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'En kritik risklerimiz neler?' })).toBeInTheDocument()
  })

  it('renders French suggestion labels', () => {
    localStorage.setItem('velora.uiLanguage', 'fr')
    render(
      <I18nProvider>
        <AiCommandPanel userName="Asma Azreug" userRole="OWNER" />
      </I18nProvider>,
    )

    expect(screen.getByRole('heading', { name: 'Comment allez-vous, Asma ?' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Combien y a-t-il en caisse ?' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Kasada ne kadar para var?')).not.toBeInTheDocument()
  })

  it('hides finance suggestions for production manager', () => {
    localStorage.setItem('velora.uiLanguage', 'tr')
    render(
      <I18nProvider>
        <AiCommandPanel userRole="PRODUCTION_MANAGER" />
      </I18nProvider>,
    )

    expect(screen.queryByRole('button', { name: 'Kasada ne kadar para var?' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Bugün ne kadar tahsilat yaptık?' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stok durumu nedir?' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bugün ne ürettik?' })).toBeInTheDocument()
  })

  it('submits a suggestion through the chat API on click', async () => {
    localStorage.setItem('velora.uiLanguage', 'tr')
    apiRequest.mockResolvedValue({
      answer: 'Kasa bakiyesi 1.000 DZD.',
      dateFrom: null,
      dateTo: null,
      generatedAt: '2026-08-17T00:00:00.000Z',
      dataFreshness: '2026-08-17T00:00:00.000Z',
      recordsUsed: 1,
      disclaimer: '',
    })
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <AiCommandPanel userRole="OWNER" />
      </I18nProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Kasada ne kadar para var?' }))

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith(
        '/ai/chat',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"conversationId":'),
        }),
      )
    })
    expect(await screen.findByText('Kasa bakiyesi 1.000 DZD.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kasada ne kadar para var?' })).not.toBeInTheDocument()
  })

  it('renders Arabic/Darija answers with automatic RTL direction', async () => {
    localStorage.setItem('velora.uiLanguage', 'tr')
    apiRequest.mockResolvedValue({
      answer: 'النتيجة: خلال الأيام السبعة القادمة 230.000 DZD مستحقة للدفع.',
      dateFrom: null,
      dateTo: null,
      generatedAt: '2026-09-04T00:00:00.000Z',
      dataFreshness: '2026-09-04T00:00:00.000Z',
      recordsUsed: 2,
      disclaimer: '',
    })
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <AiCommandPanel userRole="OWNER" />
      </I18nProvider>,
    )

    const input = screen.getByRole('textbox')
    await user.type(input, 'شحال لازم نخلص في 7 أيام؟')
    await user.click(screen.getByRole('button', { name: 'Gönder' }))

    const answer = await screen.findByText(/النتيجة:/)
    expect(answer).toHaveAttribute('dir', 'auto')
  })
})

describe('canAccessAiSuggestionDomain', () => {
  it('blocks finance domains for production manager', () => {
    expect(canAccessAiSuggestionDomain('PRODUCTION_MANAGER', 'finance')).toBe(false)
    expect(canAccessAiSuggestionDomain('PRODUCTION_MANAGER', 'customers')).toBe(false)
    expect(canAccessAiSuggestionDomain('PRODUCTION_MANAGER', 'risks')).toBe(false)
    expect(canAccessAiSuggestionDomain('PRODUCTION_MANAGER', 'stock')).toBe(true)
    expect(canAccessAiSuggestionDomain('PRODUCTION_MANAGER', 'production')).toBe(true)
  })
})
