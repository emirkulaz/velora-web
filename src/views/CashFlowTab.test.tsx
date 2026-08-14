import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../data/api', () => ({ ApiError: class ApiError extends Error {}, apiGet }))

import { CashFlowTab } from './CashFlowTab'

describe('CashFlowTab localization', () => {
  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset().mockResolvedValue({
      date: '2026-08-14', currency: 'DZD',
      kpis: { currentCash: 49390, collections30d: 120000, inflow30d: 120000, outflow30d: 70610, netCashChange30d: 49390, upcomingPayments7d: 10000, overdueDebt: 18406, expectedCollections7d: null, projectedCash7d: 39390, liquidity: 'WATCH' },
      flow: [{ date: '2026-08-13', inflow: 120000, outflow: 70610, net: 49390 }],
      calendar: [], expectedCollections: [], expectedCollectionsNotice: 'Türkçe backend mesajı', expectedCollectionsReliable: false,
    })
  })

  it('localizes liquidity metrics and does not expose backend notice text', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')
    render(<I18nProvider><CashFlowTab /></I18nProvider>)

    expect(await screen.findByRole('heading', { name: 'Cash flow' })).toBeInTheDocument()
    expect(screen.getByText('Watch')).toBeInTheDocument()
    expect(screen.getAllByText(/49,390(?:\.00)? DZD/).length).toBeGreaterThan(0)
    expect(screen.getByText('No verified expected collection data is available.')).toBeInTheDocument()
    expect(screen.queryByText('Türkçe backend mesajı')).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: '30-day cash chart' })).toBeInTheDocument()
  })
})
