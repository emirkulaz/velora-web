import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../data/api', () => ({ apiGet, apiPatch: vi.fn(), apiPost: vi.fn(), apiRequest: vi.fn() }))
import { UserManagementModule } from './UserManagementModule'

describe('UserManagementModule localization', () => {
  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset().mockResolvedValue([{ id: 1, name: 'TRIKOMEX Admin', email: 'admin@trikomex.com', role: 'ADMIN', isActive: true, createdAt: '2026-08-13T10:00:00.000Z', preferredLanguage: 'fr' }])
  })

  it('renders user roles, status, and dates in French', async () => {
    localStorage.setItem('velora.uiLanguage', 'fr')
    render(<I18nProvider><UserManagementModule /></I18nProvider>)
    expect(await screen.findByText('TRIKOMEX Admin')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Gestion des utilisateurs' })).toBeInTheDocument()
    expect(screen.getByText('Administrateur')).toBeInTheDocument()
    expect(screen.getByText('Actif')).toBeInTheDocument()
    expect(screen.getByText(/^13\/08\/2026/)).toBeInTheDocument()
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument()
  })
})
