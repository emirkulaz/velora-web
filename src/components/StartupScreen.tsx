import { useEffect } from 'react'
import { playStartupSound } from '../audio/startupSound'
import { VeloraLogo } from './VeloraLogo'
import { useI18n } from '../i18n/I18nProvider'

export function StartupScreen({
  error,
  onRetry,
}: {
  error?: string
  onRetry?: () => void
} = {}) {
  const { t } = useI18n()

  useEffect(() => {
    playStartupSound()
  }, [])

  return (
    <main className="startup-screen" aria-live="polite" aria-label="VEXOR ERP yükleniyor">
      <div className="startup-screen__backdrop" />
      <div className="startup-screen__content">
        <VeloraLogo theme="dark" className="startup-screen__logo" />
        {error ? null : <div className="startup-screen__loader" aria-hidden="true" />}
        <p>{error ? t('startup.connectionTitle') : t('startup.loading')}</p>
        <span>{error ?? t('startup.description')}</span>
        {error && onRetry ? (
          <button type="button" className="btn btn--primary" onClick={onRetry}>
            {t('startup.retry')}
          </button>
        ) : null}
      </div>
    </main>
  )
}
