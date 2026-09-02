import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { recoverFromFatalClientError } from '../runtime/appRecovery'

type Props = { children: ReactNode; title: string; description: string; reload: string }
type State = { failed: boolean }

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

    void recoverFromFatalClientError()
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
