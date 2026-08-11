import { VeloraLogo } from './VeloraLogo'
import { useI18n } from '../i18n/I18nProvider'

export function StartupScreen() {
  const { t } = useI18n()
  return (
    <main className="startup-screen" aria-live="polite" aria-label="VEXOR ERP yükleniyor">
      <div className="startup-screen__backdrop" />
      <div className="startup-screen__content">
        <VeloraLogo theme="dark" className="startup-screen__logo" />
        <div className="startup-screen__loader" aria-hidden="true" />
        <p>{t('startup.loading')}</p>
        <span>{t('startup.description')}</span>
      </div>
    </main>
  )
}
