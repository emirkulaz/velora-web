import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function isStandaloneDisplay(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean }
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  )
}

/**
 * Chrome/Edge “Uygulamayı yükle” — beforeinstallprompt ile native kurulum.
 * Prompt yoksa (Safari / henüz kriterler dolmadı) kısa Türkçe ipucu gösterir.
 */
export function InstallAppButton({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  )
  const [installed, setInstalled] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(false)

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstalled(true)
      return
    }

    try {
      if (sessionStorage.getItem('velora-install-hint-dismissed') === '1') {
        setHintDismissed(true)
      }
    } catch {
      /* ignore */
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
      setShowHint(false)
    }
    const onInstalled = () => {
      setDeferred(null)
      setInstalled(true)
      setShowHint(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    // HTTPS + SW sonrası Chrome hemen prompt verebilir; yoksa manuel ipucu.
    const hintTimer = window.setTimeout(() => {
      if (!isStandaloneDisplay()) {
        setShowHint(true)
      }
    }, 2500)

    return () => {
      window.clearTimeout(hintTimer)
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  if (deferred) {
    return (
      <button
        type="button"
        className={`install-app-btn ${className}`.trim()}
        onClick={() => {
          void (async () => {
            await deferred.prompt()
            await deferred.userChoice
            setDeferred(null)
          })()
        }}
      >
        {t('common.install')}
      </button>
    )
  }

  if (!showHint || hintDismissed) return null

  return (
    <div className={`install-app-hint ${className}`.trim()} role="status">
      <p className="install-app-hint__text">{t('common.installHint')}</p>
      <button
        type="button"
        className="install-app-hint__dismiss"
        onClick={() => {
          setHintDismissed(true)
          try {
            sessionStorage.setItem('velora-install-hint-dismissed', '1')
          } catch {
            /* ignore */
          }
        }}
      >
        {t('common.close')}
      </button>
    </div>
  )
}
