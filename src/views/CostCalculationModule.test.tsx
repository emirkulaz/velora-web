import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../data/api', () => ({ ApiError: class ApiError extends Error {}, apiDelete: vi.fn(), apiGet, apiPost: vi.fn() }))
import { CostCalculationModule } from './CostCalculationModule'

describe('CostCalculationModule localization', () => {
  beforeEach(() => { localStorage.clear(); apiGet.mockReset().mockResolvedValue([]) })
  it('renders cost calculation in English with DZD amounts', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')
    render(<I18nProvider><CostCalculationModule /></I18nProvider>)
    expect(screen.getByRole('heading', { name: 'Cost calculation' })).toBeInTheDocument()
    expect(screen.getByText('Cost summary')).toBeInTheDocument()
    expect(screen.getAllByText(/DZD/).length).toBeGreaterThan(0)
    expect(await screen.findByText('No cost calculation has been saved.')).toBeInTheDocument()
    expect(screen.queryByText(/ DA$/)).not.toBeInTheDocument()
  })
})
