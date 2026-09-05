import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const updateServiceWorker = vi.fn().mockResolvedValue(undefined)
let onNeedRefresh: (() => void) | undefined

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((options: { onNeedRefresh?: () => void }) => {
    onNeedRefresh = options.onNeedRefresh
    return updateServiceWorker
  }),
}))

import { PwaUpdatePrompt } from './PwaUpdatePrompt'

describe('PwaUpdatePrompt', () => {
  beforeEach(() => {
    onNeedRefresh = undefined
    updateServiceWorker.mockClear()
  })

  it('waits for user confirmation before activating a new service worker', async () => {
    const user = userEvent.setup()
    render(<PwaUpdatePrompt />)

    expect(screen.queryByText('Yeni VEXOR sürümü hazır.')).not.toBeInTheDocument()
    onNeedRefresh?.()
    expect(await screen.findByText('Yeni VEXOR sürümü hazır.')).toBeInTheDocument()
    expect(updateServiceWorker).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Şimdi yenile' }))
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('keeps the application usable when the service worker update fails', async () => {
    const user = userEvent.setup()
    updateServiceWorker.mockRejectedValueOnce(new Error('network'))
    render(<PwaUpdatePrompt />)

    onNeedRefresh?.()
    await user.click(await screen.findByRole('button', { name: 'Şimdi yenile' }))

    expect(
      await screen.findByText('Güncelleme tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Şimdi yenile' })).toBeEnabled()
  })
})
