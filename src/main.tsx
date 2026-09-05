import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt'
import { applyDocumentDirection } from './i18n/documentDirection'
import { startEnforceLtrFields } from './i18n/enforceLtrFields'
import { I18nProvider } from './i18n/I18nProvider'
import { setActiveUiLanguage } from './i18n/uiLanguage'
import {
  isRecoverableChunkError,
  markClientStable,
  prepareLocalDevelopmentRuntime,
  recoverFromFatalClientError,
} from './runtime/appRecovery'
import { getCanonicalRedirectUrl } from './runtime/canonicalOrigin'

setActiveUiLanguage('tr')
applyDocumentDirection('tr')
startEnforceLtrFields(document)

async function bootstrap() {
  const canonicalRedirect = getCanonicalRedirectUrl(window.location.href)

  if (canonicalRedirect) {
    window.location.replace(canonicalRedirect)
    return
  }

  if (import.meta.env.DEV && await prepareLocalDevelopmentRuntime()) return

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    void recoverFromFatalClientError()
  })
  window.addEventListener('unhandledrejection', (event) => {
    if (!isRecoverableChunkError(event.reason)) return
    event.preventDefault()
    void recoverFromFatalClientError()
  })
  markClientStable()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <AppErrorBoundary>
          <App />
          <PwaUpdatePrompt />
        </AppErrorBoundary>
      </I18nProvider>
    </StrictMode>,
  )
}

void bootstrap()
