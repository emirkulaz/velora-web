import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialReservePlan } from '../data/reservePlan'
import { ReservePlanTab } from './ReservePlanTab'
import { apiGet, apiPost } from '../data/api'
vi.mock('../data/api', () => ({ apiGet: vi.fn(), apiPost: vi.fn() }))
const snapshot = () => ({ plan: initialReservePlan(), updatedAt: '2026-10-02T10:00:00Z', generatedAt: '2026-10-02T11:00:00Z', suggestions: [], data: { currency: 'DZD', today: '2026-10-02', accounts: [{ id: 1, name: 'Ana Kasa', currency: 'DZD', balance: 225532 }], movements: [] } })
describe('ReservePlanTab', () => {
  afterEach(cleanup)
  beforeEach(() => { vi.resetAllMocks(); vi.mocked(apiGet).mockResolvedValue(snapshot()); vi.mocked(apiPost).mockResolvedValue({updatedAt:'2026-10-02T12:00:00Z'}) })
  it('shows real current cash separately, defaults the month, leaves reserve blank, and makes no posting', async () => {
    render(<ReservePlanTab canWrite />)
    expect(await screen.findByText('Güncel mevcut — Ana Kasa')).toBeInTheDocument()
    expect(screen.getByText('225.532 DZD')).toBeInTheDocument()
    expect(screen.getByLabelText('Korunacak minimum kasa rezervi (DA)')).toHaveValue(null)
    expect(screen.getByLabelText('Plan ayı')).toHaveValue('2026-10')
    expect(screen.getAllByText('Rezerv hedefi belirlenmedi').length).toBeGreaterThan(0)
    expect(screen.getByText(/Vade girilmeli/)).toBeInTheDocument()
    expect(screen.getByText('Sigorta dahil')).toBeInTheDocument(); expect(screen.getByText('Sigorta ayrı')).toBeInTheDocument()
    expect(screen.getByText('30.110 DA')).toBeInTheDocument()
    expect(apiPost).not.toHaveBeenCalled()
  })
  it('checks missing month before saving and saves only a plan payload once specified', async () => {
    render(<ReservePlanTab canWrite />); await screen.findByText('Güncel mevcut — Ana Kasa')
    fireEvent.change(screen.getByLabelText('Plan ayı'),{target:{value:''}})
    fireEvent.click(screen.getByRole('button',{name:'Planı kaydet'})); expect(apiPost).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('Plan ayını seçin')
    fireEvent.change(screen.getByLabelText('Plan ayı'),{target:{value:'2026-10'}})
    fireEvent.change(screen.getByLabelText('Korunacak minimum kasa rezervi (DA)'),{target:{value:'50000'}})
    fireEvent.click(screen.getByRole('button',{name:'Planı kaydet'}))
    await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/reserve-plan',expect.objectContaining({plan:expect.objectContaining({month:'2026-10',reserve:50000})})))
    expect(await screen.findByText('Plan kaydedildi. Tahsilat, ödeme veya transfer oluşturulmadı.')).toBeInTheDocument()
  })
  it('renders bank availability and the requested reserve control without inventing a date', async () => {
    render(<ReservePlanTab canWrite />); await screen.findByText('Güncel mevcut — Ana Kasa')
    fireEvent.change(screen.getByLabelText('Korunacak minimum kasa rezervi (DA)'),{target:{value:'50000'}})
    fireEvent.click(screen.getByLabelText('Banka kullanılabilir (kasaya transfer ayrıca seçilir)'))
    expect(screen.getByText('19.890 DA')).toBeInTheDocument()
    expect(screen.getAllByText('Sigorta: vade eksik.')).toHaveLength(2)
  })
  it('does not prefill another company with this user scenario', async () => {
    vi.mocked(apiGet).mockResolvedValue({...snapshot(),plan:null})
    render(<ReservePlanTab canWrite />); await screen.findByText('Güncel mevcut — Ana Kasa')
    expect(screen.queryByDisplayValue('Dedouche — kullanıcı beyanı')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Banka senaryo tutarı (boş: ERP bakiyesi)')).toHaveValue(null)
  })
  it('allows changing month, due date and insurance inclusion while keeping reserve optional', async () => {
    render(<ReservePlanTab canWrite />); await screen.findByText('Güncel mevcut — Ana Kasa')
    fireEvent.change(screen.getByLabelText('Plan ayı'),{target:{value:'2026-11'}})
    const dates=screen.getAllByLabelText('Ödeme vadesi')
    expect(dates[1]).toHaveValue('')
    fireEvent.change(dates[1],{target:{value:'2026-11-10'}})
    fireEvent.change(screen.getByLabelText('Sigorta 334.200 DA gider toplamında mı?'),{target:{value:'included'}})
    fireEvent.click(screen.getByRole('button',{name:'Planı kaydet'}))
    await waitFor(()=>expect(apiPost).toHaveBeenCalledWith('/reserve-plan',expect.objectContaining({plan:expect.objectContaining({month:'2026-11',reserve:null,insuranceMode:'included',lines:expect.arrayContaining([expect.objectContaining({kind:'insurance',amount:156000,date:'2026-11-10'})])})})))
    expect(screen.queryByText(/Vade girilmeli/)).not.toBeInTheDocument()
    expect(screen.getByText('186.110 DA')).toBeInTheDocument()
  })
})

