import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'

type Props = { children: ReactNode; title: string; description: string; reload: string }
type State = { failed: boolean }

const RECOVERY_ATTEMPT_KEY = 'vexor.error-recovery-attempted'

async function clearStaleAppAssets() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
  }

  if ('caches' in window) {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  }
}

class ErrorBoundaryImpl extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      JSON.stringify({
        event: 'ui_render_failed',
        errorType: error.name || 'Error',
        componentStackAvailable: Boolean(info.componentStack),
      }),
    )

    if (!sessionStorage.getItem(RECOVERY_ATTEMPT_KEY)) {
      sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, '1')
      const url = new URL(window.location.href)
      url.searchParams.set('vexor-reload', String(Date.now()))
      void clearStaleAppAssets().finally(() => window.location.replace(url.toString()))
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-fallback" role="alert">
          <h1>{this.props.title}</h1>
          <p>{this.props.description}</p>
          <button type="button" onClick={() => window.location.reload()}>
            {this.props.reload}
          </button>
        </main>
      )
    }

    return this.props.children
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return <ErrorBoundaryImpl title={t('errorBoundary.title')} description={t('errorBoundary.description')} reload={t('errorBoundary.reload')}>{children}</ErrorBoundaryImpl>
}
