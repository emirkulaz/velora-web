import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

import { ProductionModule } from './ProductionModule'

describe('ProductionModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/products') return Promise.resolve([])
      return Promise.resolve([
        {
          id: 9,
          orderNumber: 'PO-2026-09',
          productId: 2,
          productCode: 'COL-01',
          productName: 'Textile collar',
          plannedQuantity: 1000,
          completedQuantity: 250,
          progress: 25,
          unit: 'PIECE',
          status: 'IN_PROGRESS',
          dueDate: '2026-08-10',
          notes: null,
          delayed: true,
          stockWarnings: [],
          materials: [],
        },
      ])
    })
  })

  it('translates production status and units without exposing API enums', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')

    render(
      <I18nProvider>
        <ProductionModule />
      </I18nProvider>,
    )

    expect(await screen.findByText('PO-2026-09')).toBeInTheDocument()
    expect(screen.getAllByText('Delayed').length).toBeGreaterThan(0)
    expect(screen.getByText(/1,000 Piece/)).toBeInTheDocument()
    expect(screen.getByText(/^10\/08\/2026/)).toBeInTheDocument()
    expect(screen.queryByText('IN_PROGRESS')).not.toBeInTheDocument()
    expect(screen.queryByText('PIECE')).not.toBeInTheDocument()
  })
})
