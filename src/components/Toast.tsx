import { useEffect } from 'react'

type ToastProps = {
  message: string
  onDismiss: () => void
}

export function SuccessToast({ message, onDismiss }: ToastProps) {
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
        aria-label="Bildirimi kapat"
      >
        ×
      </button>
    </div>
  )
}
