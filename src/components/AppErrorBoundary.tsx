import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('VEXOR arayüz hatası', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-fallback" role="alert">
          <h1>VEXOR şu anda bu ekranı gösteremiyor.</h1>
          <p>Verileriniz etkilenmedi. Sayfayı yenileyerek tekrar deneyin.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Sayfayı yenile
          </button>
        </main>
      )
    }

    return this.props.children
  }
}
