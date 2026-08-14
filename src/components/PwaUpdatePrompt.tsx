import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useI18n } from '../i18n/I18nProvider'

export function PwaUpdatePrompt() {
  const { t } = useI18n()
  const [needRefresh, setNeedRefresh] = useState(false)
  const updateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
    })
  }, [])

  if (!needRefresh) return null

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      <div>
        <strong>{t('pwa.updateReady')}</strong>
        <span>{t('pwa.updateDescription')}</span>
      </div>
      <button
        type="button"
        className="btn btn--primary"
        onClick={() => void updateRef.current?.(true)}
      >
        {t('pwa.updateNow')}
      </button>
      <button
        type="button"
        className="btn btn--ghost"
        aria-label={t('pwa.dismissUpdate')}
        onClick={() => setNeedRefresh(false)}
      >
        {t('common.later')}
      </button>
    </aside>
  )
}
