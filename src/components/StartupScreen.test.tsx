import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StartupScreen } from './StartupScreen'

describe('StartupScreen', () => {
  it('keeps the session recovery screen actionable during a backend outage', async () => {
    const retry = vi.fn()
    const user = userEvent.setup()
    render(<StartupScreen error="Backend geçici olarak kapalı." onRetry={retry} />)

    expect(screen.getByText('Sunucu bağlantısı bekleniyor')).toBeInTheDocument()
    expect(screen.getByText('Backend geçici olarak kapalı.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Şimdi tekrar dene' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
