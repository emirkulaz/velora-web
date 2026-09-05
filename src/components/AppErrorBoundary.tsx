import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import {
  isRecoverableChunkError,
  recoverFromFatalClientError,
} from '../runtime/appRecovery'

type Props = { children: ReactNode; title: string; description: string; reload: string }
type State = { failed: boolean }
type SectionProps = {
  children: ReactNode
  resetKey: string
  title: string
  description: string
  retry: string
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

    if (isRecoverableChunkError(error)) {
      void recoverFromFatalClientError()
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-fallback" role="alert">
          <h1>{this.props.title}</h1>
          <p>{this.props.description}</p>
          <button
            type="button"
            onClick={() => void recoverFromFatalClientError({ force: true })}
          >
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

class SectionErrorBoundaryImpl extends Component<SectionProps, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      JSON.stringify({
        event: 'ui_section_render_failed',
        section: this.props.resetKey,
        errorType: error.name || 'Error',
        componentStackAvailable: Boolean(info.componentStack),
      }),
    )
    if (isRecoverableChunkError(error)) {
      void recoverFromFatalClientError()
    }
  }

  componentDidUpdate(previous: SectionProps) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="section-fallback" role="alert">
          <strong>{this.props.title}</strong>
          <span>{this.props.description}</span>
          <button type="button" onClick={() => this.setState({ failed: false })}>
            {this.props.retry}
          </button>
        </section>
      )
    }

    return this.props.children
  }
}

export function SectionErrorBoundary({
  children,
  resetKey,
}: {
  children: ReactNode
  resetKey: string
}) {
  const { t } = useI18n()
  return (
    <SectionErrorBoundaryImpl
      resetKey={resetKey}
      title={t('errorBoundary.sectionTitle')}
      description={t('errorBoundary.sectionDescription')}
      retry={t('errorBoundary.retry')}
    >
      {children}
    </SectionErrorBoundaryImpl>
  )
}
