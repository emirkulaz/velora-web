import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiDelete: vi.fn(),
  apiGet,
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

import { ProductsModule } from './ProductsModule'

describe('ProductsModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset().mockResolvedValue([
      {
        id: 3,
        code: 'COL-01',
        name: 'Col textile',
        category: 'Yaka',
        color: null,
        widthCm: null,
        unit: 'PIECE',
        productType: 'COLLAR',
        yarnType: 'Polyester',
        weightGramPerSaleUnit: 24.5,
        yarnPricePerKg: 400,
        costPrice: 800,
        salePrice: 1250,
        isActive: true,
        stockQuantity: 1200,
      },
    ])
  })

  it('translates product enums and formats stock values for the selected locale', async () => {
    localStorage.setItem('velora.uiLanguage', 'fr')

    render(
      <I18nProvider>
        <ProductsModule
          company={{ companyId: 1, name: 'TRIKOMEX Textile', currency: 'DZD', logo: null, sectorPack: 'TEXTILE' }}
        />
      </I18nProvider>,
    )

    expect(await screen.findByText('Col textile')).toBeInTheDocument()
    expect(screen.getAllByText('Col').length).toBeGreaterThan(0)
    expect(screen.getByText('Pièce')).toBeInTheDocument()
    expect(screen.getByText(/1[\s\u202f]250 DZD\/pièce/)).toBeInTheDocument()
    expect(screen.getAllByText(/1[\s\u202f]200/).length).toBeGreaterThan(0)
    expect(screen.queryByText('COLLAR')).not.toBeInTheDocument()
  })
})
