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

import { CustomersModule } from './CustomersModule'

describe('CustomersModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset().mockResolvedValue([
      {
        id: 1,
        name: 'Client Alger',
        contactName: 'Amina',
        taxNumber: null,
        email: null,
        phone: null,
        country: 'Algeria',
        city: 'Alger',
        address: null,
        isActive: true,
      },
    ])
  })

  it('renders customer actions and status in the selected language', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')

    render(
      <I18nProvider>
        <CustomersModule canWrite canDelete />
      </I18nProvider>,
    )

    expect(await screen.findByText('Client Alger')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Customer list' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New customer/ })).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})
