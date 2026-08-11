import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { applyDocumentDirection } from './i18n/documentDirection'
import { startEnforceLtrFields } from './i18n/enforceLtrFields'
import { I18nProvider } from './i18n/I18nProvider'
import { setActiveUiLanguage } from './i18n/uiLanguage'

setActiveUiLanguage('tr')
applyDocumentDirection('tr')
startEnforceLtrFields(document)

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
