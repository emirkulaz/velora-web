import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('../data/api', () => ({ apiGet, apiPatch: vi.fn() }))

import { OverviewModule } from './OverviewModule'

const dashboard = {
  currency: 'DZD',
  date: '2026-08-14',
  kpis: {
    todayRevenue: 49390,
    estimatedGrossProfit: 12000,
    profitCoverage: 80,
    expenses: 5000,
    cashBalance: 49390,
    totalReceivable: 1576610,
    totalPayable: 118406,
    totalSupplierDebt: 118406,
    overdueSupplierDebt: 0,
    stockValue: 2349188,
    openOrders: 2,
    overdueOrders: 1,
    inProduction: 3,
  },
  comparisons: { revenue30d: 10, expense30d: -5 },
  charts: { sales: [], collections: [], cashFlow: [], topProducts: [] },
  production: { completedToday: 1, inProgress: 3, completedQuantity: {} },
  alerts: [],
  recent: [],
  aiSummary: 'Résumé opérationnel',
}

describe('OverviewModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset().mockResolvedValue(dashboard)
  })

  it('renders dashboard labels and DZD values using the selected locale', async () => {
    localStorage.setItem('velora.uiLanguage', 'fr')

    render(
      <I18nProvider>
        <OverviewModule />
      </I18nProvider>,
    )

    expect(await screen.findByText('Le pouls de l’entreprise sur un seul écran.')).toBeInTheDocument()
    expect(screen.getByText('Trésorerie totale')).toBeInTheDocument()
    expect(screen.getAllByText(/49[\s\u202f]390 DZD/).length).toBeGreaterThan(0)
    expect(screen.getByText('Aucune alerte critique.')).toBeInTheDocument()
  })
})
