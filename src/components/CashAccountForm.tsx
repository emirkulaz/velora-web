import { useState, type FormEvent } from 'react'
import { apiPost } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

export function CashAccountForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function save(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      await apiPost('/cash-accounts', { name: name.trim(), code: code.trim() })
      setName(''); setCode(''); setMessage(t('reserve.accountSaved')); onCreated()
    } catch (e) { setError(e instanceof Error ? e.message : t('reserve.accountError')) }
    finally { setBusy(false) }
  }
  return <details><summary>{t('reserve.addAccount')}</summary>
    <p>{t('reserve.accountHelp')}</p>
    <form onSubmit={event => void save(event)} className="demo-form">
      <label>{t('reserve.accountName')}<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} /></label>
      <label>{t('reserve.accountCode')}<input required pattern="[A-Za-z0-9_-]+" maxLength={64} dir="ltr" value={code} onChange={e=>setCode(e.target.value)} /></label>
      <button type="submit" className="btn btn--primary" disabled={busy || !name.trim() || !code.trim()}>{t('reserve.createAccount')}</button>
      {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    </form>
  </details>
}
