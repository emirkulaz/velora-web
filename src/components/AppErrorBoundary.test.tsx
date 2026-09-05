import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'
import { SectionErrorBoundary } from './AppErrorBoundary'

function BrokenSection(): never {
  throw new Error('render failure')
}

describe('SectionErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('isolates one broken module and recovers when navigation changes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const view = render(
      <I18nProvider>
        <SectionErrorBoundary resetKey="orders">
          <BrokenSection />
        </SectionErrorBoundary>
      </I18nProvider>,
    )

    expect(
      screen.getByText('Bu bölüm geçici olarak gösterilemiyor.'),
    ).toBeInTheDocument()

    view.rerender(
      <I18nProvider>
        <SectionErrorBoundary resetKey="customers">
          <div>Müşteriler hazır</div>
        </SectionErrorBoundary>
      </I18nProvider>,
    )

    expect(await screen.findByText('Müşteriler hazır')).toBeInTheDocument()
  })
})
