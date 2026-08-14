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

import { InventoryModule } from './InventoryModule'

describe('InventoryModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/products') return Promise.resolve([])
      if (path === '/warehouses') return Promise.resolve([{ id: 1, code: 'MAIN', name: 'Main' }])
      return Promise.resolve([
        {
          productId: 4,
          code: 'YARN-01',
          name: 'Polyester yarn',
          unit: 'KILOGRAM',
          color: 'Black',
          widthCm: null,
          category: null,
          yarnType: 'Polyester',
          productType: null,
          costPrice: 400,
          unitCost: 400,
          quantity: 1200.5,
          reservedQuantity: 0,
          availableQuantity: 1200.5,
          totalValue: 480200,
          valueComputable: true,
          valueNote: null,
          criticalLevel: 10,
          isCritical: false,
          source: 'MOVEMENT',
          packageCount: 20,
          warehouses: [{ code: 'MAIN', name: 'Main', quantity: 1200.5, packageCount: 20 }],
        },
      ])
    })
  })

  it('renders yarn stock labels and amounts in the selected locale', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')

    render(
      <I18nProvider>
        <InventoryModule
          kind="yarn"
          company={{ companyId: 1, name: 'TRIKOMEX Textile', currency: 'DZD', logo: null, sectorPack: 'TEXTILE' }}
        />
      </I18nProvider>,
    )

    expect(await screen.findByText('Polyester yarn')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Yarn inventory' })).toBeInTheDocument()
    expect(screen.getByText('Raw material / yarn')).toBeInTheDocument()
    expect(screen.getAllByText('1,200.5').length).toBeGreaterThan(0)
    expect(screen.getAllByText('480,200.00').length).toBeGreaterThan(0)
    expect(screen.queryByText('KILOGRAM')).not.toBeInTheDocument()
  })
})
