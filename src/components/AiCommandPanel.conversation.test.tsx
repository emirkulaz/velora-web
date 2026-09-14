import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }))
vi.mock('../data/api', () => ({ ApiError: class extends Error {}, apiRequest, apiPost: vi.fn(), apiDownload: vi.fn(), apiPatch: vi.fn() }))
vi.mock('../hooks/useSpeechToText', () => ({ useSpeechToText: () => ({ isSupported: false, isListening: false }) }))
import { AiCommandPanel } from './AiCommandPanel'
afterEach(cleanup)
beforeEach(() => { localStorage.clear(); apiRequest.mockReset() })
const answer = (text: string) => ({ answer: text, generatedAt: '2026-09-14T10:00:00Z' })
it('keeps previous answers and the conversation id across follow-up questions', async () => {
  apiRequest.mockResolvedValueOnce(answer('First answer')).mockResolvedValueOnce(answer('Second answer'))
  render(<I18nProvider><AiCommandPanel /></I18nProvider>)
  const user = userEvent.setup()
  const input = screen.getByRole('textbox')
  await user.type(input, 'First question{Enter}')
  await screen.findByText('First answer')
  expect(input).toHaveValue('')
  await user.type(input, 'Follow-up{Enter}')
  await screen.findByText('Second answer')
  expect(screen.getByText('First answer')).toBeInTheDocument()
  const payloads = apiRequest.mock.calls.map((call) => JSON.parse(call[1].body))
  expect(payloads[0].conversationId).toBe(payloads[1].conversationId)
})
it('retries the failed question without losing the previous answer', async () => {
  apiRequest.mockResolvedValueOnce(answer('Existing answer')).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(answer('Recovered answer'))
  render(<I18nProvider><AiCommandPanel /></I18nProvider>)
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox'), 'First{Enter}')
  await screen.findByText('Existing answer')
  await user.type(screen.getByRole('textbox'), 'Next{Enter}')
  await screen.findByRole('alert')
  expect(screen.getByText('Existing answer')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /Tekrar dene|Try again|Réessayer/ }))
  await screen.findByText('Recovered answer')
  expect(JSON.parse(apiRequest.mock.calls[2][1].body).message).toBe('Next')
})
