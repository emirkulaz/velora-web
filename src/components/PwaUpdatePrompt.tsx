import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { useI18n } from '../i18n/I18nProvider'

export function PwaUpdatePrompt() {
  const { t } = useI18n()
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updateFailed, setUpdateFailed] = useState(false)
  const updateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh: () => setNeedRefresh(true),
      onRegisterError: () => setUpdateFailed(true),
    })
  }, [])

  if (!needRefresh) return null

  return (
    <aside className="pwa-update" role="status" aria-live="polite">
      <div>
        <strong>{t('pwa.updateReady')}</strong>
        <span>
          {updateFailed ? t('pwa.updateFailed') : t('pwa.updateDescription')}
        </span>
      </div>
      <button
        type="button"
        className="btn btn--primary"
        disabled={updating}
        onClick={() => {
          setUpdating(true)
          setUpdateFailed(false)
          void updateRef.current?.(true).catch(() => {
            setUpdating(false)
            setUpdateFailed(true)
          })
        }}
      >
        {updating ? t('pwa.updating') : t('pwa.updateNow')}
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
