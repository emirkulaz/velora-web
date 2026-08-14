import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiDownload: vi.fn(), apiPost: vi.fn(), apiRequest: vi.fn(),
}))
vi.mock('../hooks/useSpeechToText', () => ({
  useSpeechToText: () => ({ isListening: false, isSupported: false, error: '', start: vi.fn(), stop: vi.fn() }),
}))

import { AiCommandPanel } from './AiCommandPanel'

describe('AiCommandPanel localization', () => {
  beforeEach(() => localStorage.clear())

  it('renders the central assistant and quick commands in French', async () => {
    localStorage.setItem('velora.uiLanguage', 'fr')
    const user = userEvent.setup()
    render(<I18nProvider><AiCommandPanel userName="Asma Azreug" /></I18nProvider>)

    expect(screen.getByRole('heading', { name: 'Comment allez-vous, Asma ?' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Demandez à VEXOR')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Afficher les questions rapides' }))
    expect(screen.getByRole('button', { name: 'Que s’est-il passé aujourd’hui ?' })).toBeInTheDocument()
    expect(screen.queryByText('Bugün neler oldu?')).not.toBeInTheDocument()
  })
})
