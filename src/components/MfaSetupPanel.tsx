import { useState } from 'react'
import { apiPost } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

export function MfaSetupPanel() {
  const { t } = useI18n()
  const [uri, setUri] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const begin = async () => {
    setError('')
    try { setUri((await apiPost<{ otpauthUri: string }>('/auth/mfa/setup', {})).otpauthUri) } catch { setError(t('mfa.beginError')) }
  }
  const confirm = async () => {
    setError('')
    try {
      const result = await apiPost<{ recoveryCodes: string[] }>('/auth/mfa/confirm', { code })
      setRecoveryCodes(result.recoveryCodes); setUri(''); setCode('')
    } catch { setError(t('mfa.invalidCode')) }
  }
  if (recoveryCodes.length) return <section><strong>{t('mfa.recoveryTitle')}</strong><code className="mfa-recovery-codes">{recoveryCodes.join('\n')}</code><button type="button" onClick={() => setRecoveryCodes([])}>{t('mfa.closeCodes')}</button></section>
  if (uri) return <section><p>{t('mfa.importUri')}</p><code className="mfa-setup-uri">{uri}</code><input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder={t('mfa.codePlaceholder')} /><button type="button" onClick={() => void confirm()}>{t('mfa.enable')}</button>{error && <p role="alert">{error}</p>}</section>
  return <><button type="button" className="header-popover__action" onClick={() => void begin()}>{t('mfa.setup')}</button>{error && <p role="alert">{error}</p>}</>
}
