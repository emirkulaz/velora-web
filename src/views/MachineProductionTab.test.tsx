import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiGet, apiPost } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiGet,
  apiPost,
  apiPatch: vi.fn(),
}))

import { MachineProductionTab } from './MachineProductionTab'

const machines = [
  {
    id: 1,
    code: 'MZ252-01',
    name: 'Ana şerit makinesi',
    model: 'MZ252',
    gauge: 14,
    workingWidthCm: 90,
    feederCount: 12,
    serialNumber: 'TRK-001',
    status: 'RUNNING',
    notes: null,
    activeOrder: {
      id: 9,
      orderNumber: 'PO-20260903-001',
      productName: 'Polyester şerit',
      plannedQuantity: 1000,
      goodQuantity: 700,
      defectiveQuantity: 20,
      scrapQuantity: 10,
      yarnUsedQuantity: 12,
      unit: 'METER',
      progress: 70,
      efficiency: 95.9,
      downtimeReason: null,
      operator: { id: 4, name: 'Adem' },
      yarnLot: { id: 7, lotNumber: 'LOT-42' },
    },
  },
  {
    id: 2,
    code: 'MZ252-02',
    name: 'Yedek makine',
    model: 'MZ252',
    gauge: 14,
    workingWidthCm: 90,
    feederCount: 12,
    serialNumber: 'TRK-002',
    status: 'AVAILABLE',
    notes: null,
    activeOrder: null,
  },
]

function setupApi() {
  apiGet.mockImplementation((path: string) => {
    if (path === '/textile-machines/dashboard') return Promise.resolve(machines)
    if (path === '/production-orders') return Promise.resolve([])
    if (path === '/employees') return Promise.resolve([{ id: 4, name: 'Adem' }])
    if (path === '/textile-machines/yarn-lots') return Promise.resolve([])
    if (path === '/products') return Promise.resolve([])
    if (path === '/warehouses') return Promise.resolve([])
    return Promise.resolve([])
  })
}

describe('MachineProductionTab', () => {
  afterEach(cleanup)

  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset()
    apiPost.mockReset().mockResolvedValue({})
    setupApi()
  })

  it('makine kartında durum, emir, operatör ve verimliliği gösterir', async () => {
    render(<I18nProvider><MachineProductionTab canWrite /></I18nProvider>)
    expect(await screen.findByText('MZ252-01')).toBeInTheDocument()
    expect(screen.getByText('PO-20260903-001')).toBeInTheDocument()
    expect(screen.getByText(/Adem/)).toBeInTheDocument()
    expect(screen.getByText('%95,9')).toBeInTheDocument()
  })

  it('durum filtresi yalnız seçili makineleri bırakır', async () => {
    const user = userEvent.setup()
    render(<I18nProvider><MachineProductionTab canWrite /></I18nProvider>)
    await screen.findByText('MZ252-01')
    const filters = screen.getByLabelText('Makine durum filtreleri')
    await user.click(within(filters).getByRole('button', { name: 'Boşta' }))
    expect(screen.queryByText('MZ252-01')).not.toBeInTheDocument()
    expect(screen.getByText('MZ252-02')).toBeInTheDocument()
  })

  it('salt-okunur kullanıcıya üretim ve makine yazma düğmelerini göstermez', async () => {
    render(<I18nProvider><MachineProductionTab canWrite={false} /></I18nProvider>)
    await screen.findByText('MZ252-01')
    expect(screen.queryByRole('button', { name: 'Üretim gir' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Makine$/ })).not.toBeInTheDocument()
  })

  it('API hatasını çökmeden kullanıcıya gösterir', async () => {
    apiGet.mockImplementation((path: string) =>
      path === '/textile-machines/dashboard'
        ? Promise.reject(new Error('network'))
        : Promise.resolve([]),
    )
    render(<I18nProvider><MachineProductionTab canWrite /></I18nProvider>)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Makine üretim paneli alınamadı.'))
  })
})
