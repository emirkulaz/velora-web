import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../data/api', () => ({ apiDelete: vi.fn(), apiGet, apiPatch: vi.fn(), apiRequest: vi.fn() }))
import { UsersModule } from './UsersModule'

describe('UsersModule employee localization', () => {
  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/employees') return Promise.resolve([{ id: 13, userId: 2, externalCode: '13', name: 'Asma Azreug', isActive: true, monthlySalaryGross: 120000, salaryCurrency: 'DZD', salaryReviewRequired: false, createdAt: '2026-08-01T00:00:00Z' }, { id: 30, userId: null, externalCode: '30', name: 'Nadia', isActive: true, monthlySalaryGross: null, salaryCurrency: 'DZD', salaryReviewRequired: true, createdAt: '2026-08-01T00:00:00Z' }])
      return Promise.resolve([])
    })
  })

  it('renders employee records and salary review state in English', async () => {
    localStorage.setItem('velora.uiLanguage', 'en')
    render(<I18nProvider><UsersModule /></I18nProvider>)
    expect(await screen.findByText('Asma Azreug')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'TRIKOMEX employees' })).toBeInTheDocument()
    expect(screen.getAllByText(/120,000(?:\.00)? DZD/).length).toBeGreaterThan(0)
    expect(screen.getByText('Review required')).toBeInTheDocument()
    expect(screen.queryByText('İnceleme gerekiyor')).not.toBeInTheDocument()
  })
})
