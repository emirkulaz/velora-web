import { useState } from 'react'
import { apiPost } from '../data/api'

export function MfaSetupPanel() {
  const [uri, setUri] = useState('')
  const [code, setCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [error, setError] = useState('')
  const begin = async () => {
    setError('')
    try { setUri((await apiPost<{ otpauthUri: string }>('/auth/mfa/setup', {})).otpauthUri) } catch { setError('MFA kurulumu başlatılamadı.') }
  }
  const confirm = async () => {
    setError('')
    try {
      const result = await apiPost<{ recoveryCodes: string[] }>('/auth/mfa/confirm', { code })
      setRecoveryCodes(result.recoveryCodes); setUri(''); setCode('')
    } catch { setError('Doğrulama kodu geçersiz.') }
  }
  if (recoveryCodes.length) return <section><strong>Kurtarma kodları — yalnız bir kez gösterilir</strong><code className="mfa-recovery-codes">{recoveryCodes.join('\n')}</code><button type="button" onClick={() => setRecoveryCodes([])}>Kodları kapat</button></section>
  if (uri) return <section><p>Authenticator uygulamasında bu kurulum adresini içe aktarın:</p><code className="mfa-setup-uri">{uri}</code><input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="6 haneli kod" /><button type="button" onClick={() => void confirm()}>MFA’yı etkinleştir</button>{error && <p role="alert">{error}</p>}</section>
  return <><button type="button" className="header-popover__action" onClick={() => void begin()}>Authenticator MFA kur</button>{error && <p role="alert">{error}</p>}</>
}
