import { useI18n } from '../i18n/I18nProvider'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n()
  if (!open) return null

  return (
    <div className="modal-overlay" onClick={onCancel} role="presentation">
      <div
        className="modal modal--confirm"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="modal__header">
          <h3 id="confirm-title">{title}</h3>
        </div>
        <div className="modal__body">
          <p className="confirm-message">{message}</p>
          <div className="confirm-actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              {t('common.cancel')}
            </button>
            <button type="button" className="btn btn--primary" onClick={onConfirm}>
              {confirmLabel ?? t('common.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
