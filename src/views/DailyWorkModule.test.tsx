import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { DailyWorkModule } from './DailyWorkModule'

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }))
vi.mock('../data/api', () => ({ apiGet }))
vi.mock('../components/ReportButton', () => ({ ReportButton: () => null }))
vi.mock('./DailyWorkActions', () => ({ DailyWorkActions: () => null }))
beforeEach(() => { apiGet.mockReset(); localStorage.clear() })
afterEach(cleanup)
const show = () => render(<I18nProvider><DailyWorkModule /></I18nProvider>)

it('does not show empty deliveries while loading', () => {
  apiGet.mockReturnValue(new Promise(() => {}))
  show()
  expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor')
  expect(screen.queryByText('Bekleyen teslimat yok.')).not.toBeInTheDocument()
})

it.each(['/orders', '/customer-requests'])('reports failed %s without presenting zero work', async (failed) => {
  apiGet.mockImplementation((path) => path === failed ? Promise.reject(new Error('offline')) : Promise.resolve([]))
  show()
  expect(await screen.findByRole('alert')).toHaveTextContent('Günlük özet yüklenemedi.')
  expect(screen.queryByText('Bekleyen teslimat yok.')).not.toBeInTheDocument()
  expect(screen.getByText('Bekleyen teslimat').closest('article')).toHaveTextContent('—')
})

it('shows an empty state only after successful reads', async () => {
  apiGet.mockResolvedValue([])
  show()
  expect(await screen.findByText('Bekleyen teslimat yok.')).toBeInTheDocument()
})

it('counts all pending deliveries while limiting visible rows and excluding completed quantities', async () => {
  const orders = Array.from({ length: 12 }, (_, id) => ({ id, orderNumber: `SO-${id}`, customerName: 'Client', status: 'CONFIRMED', quantity: 100, deliveredQuantity: id === 11 ? 100 : 0 }))
  apiGet.mockImplementation((path) => Promise.resolve(path === '/orders' ? orders : []))
  show()
  const table = await screen.findByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(9)
  expect(screen.getByText('Bekleyen teslimat').closest('article')).toHaveTextContent('11')
})
