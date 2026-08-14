import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet, apiRequest } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiRequest: vi.fn(),
}))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiPatch: vi.fn(),
  apiRequest,
}))

import { CustomerRequestsModule } from './CustomerRequestsModule'

describe('CustomerRequestsModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    apiRequest.mockReset()
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/customers') return Promise.resolve([{ id: 1, name: 'Client Oran' }])
      if (path === '/products') return Promise.resolve([])
      return Promise.resolve([
        {
          id: 7,
          customerId: 1,
          customerName: 'Client Oran',
          contactDate: '2026-08-14',
          contactMethod: 'IN_PERSON',
          requestText: 'Ruban textile',
          requestedProduct: null,
          widthCm: null,
          colorCount: null,
          estimatedQuantity: 500,
          unit: 'METER',
          requestedDeliveryDate: null,
          quotedUnitPrice: 100,
          notes: null,
          status: 'REVIEWING',
          convertedOrder: null,
        },
      ])
    })
  })

  it('translates API enum labels without changing their values', async () => {
    localStorage.setItem('velora.uiLanguage', 'fr')

    render(
      <I18nProvider>
        <CustomerRequestsModule canWrite />
      </I18nProvider>,
    )

    expect(await screen.findByText('Ruban textile')).toBeInTheDocument()
    expect(screen.getByText('En personne')).toBeInTheDocument()
    expect(screen.getAllByText('En cours d’examen').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Convertir en commande' })).toBeInTheDocument()
    expect(screen.queryByText('IN_PERSON')).not.toBeInTheDocument()
    expect(screen.queryByText('REVIEWING')).not.toBeInTheDocument()
  })
})
