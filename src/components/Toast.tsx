import { useEffect } from 'react'
import { useI18n } from '../i18n/I18nProvider'

type ToastProps = {
  message: string
  onDismiss: () => void
}

export function SuccessToast({ message, onDismiss }: ToastProps) {
  const { t } = useI18n()
  useEffect(() => {
    if (!message) return

    const timeoutId = window.setTimeout(onDismiss, 4000)
    return () => window.clearTimeout(timeoutId)
  }, [message, onDismiss])

  if (!message) return null

  return (
    <div className="toast toast--success" role="status" aria-live="polite">
      {message}
      <button
        type="button"
        className="toast__close"
        onClick={onDismiss}
        aria-label={t('common.dismissNotification')}
      >
        ×
      </button>
    </div>
  )
}
