import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  clearLastCompanyPresentation,
  isRememberedTrikomex,
  rememberCompanyPresentation,
  type CompanyPresentation,
} from '../data/companyBranding'
import { VeloraLogo } from './VeloraLogo'
import './LoginScreen.css'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

interface LoginScreenProps {
  rememberedCompany: CompanyPresentation | null
  onAuthenticated: (
    company: CompanyPresentation | null,
    options?: { mustChangePassword?: boolean },
  ) => void
}

export function LoginScreen({
  rememberedCompany,
  onAuthenticated,
}: LoginScreenProps) {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const rememberedTrikomex = isRememberedTrikomex(rememberedCompany)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const identifier = login.trim()
      const payload = identifier.includes('@')
        ? { email: identifier, password }
        : { login: identifier, password }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Giriş yapılamadı.')
      }

      const { accessToken, mustChangePassword } = (await response.json()) as {
        accessToken: string
        mustChangePassword?: boolean
      }
      const tokenStorage = rememberMe ? localStorage : sessionStorage
      const otherStorage = rememberMe ? sessionStorage : localStorage
      tokenStorage.setItem('velora.accessToken', accessToken)
      otherStorage.removeItem('velora.accessToken')
      if (!rememberMe) clearLastCompanyPresentation()

      let company: CompanyPresentation | null = null

      try {
        const companyResponse = await fetch(`${API_BASE_URL}/companies`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (companyResponse.ok) {
          company = rememberCompanyPresentation(await companyResponse.json())
          if (!rememberMe) clearLastCompanyPresentation()
        }
      } catch {
        // Preserve the successful session when the optional presentation lookup fails.
      }

      onAuthenticated(company, { mustChangePassword: Boolean(mustChangePassword) })
    } catch {
      setError('Giriş bilgileri hatalı. Lütfen tekrar deneyin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <VeloraLogo variant="full" theme="light" />
        <div className="login-panel__heading">
          <p className="login-panel__eyebrow">
            {rememberedTrikomex ? `${rememberedCompany.name} · Velora ERP` : 'Velora ERP'}
          </p>
          <h1 id="login-title">Hesabınıza giriş yapın</h1>
          <p>
            {rememberedTrikomex
              ? `${rememberedCompany.name} operasyonlarını güvenle yönetin.`
              : 'Operasyonlarınızı Velora ile güvenle yönetin.'}
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            E-posta veya kullanıcı adı
            <input
              type="text"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Parola
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label className="login-form__remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
            />
            <span>Beni hatırla</span>
          </label>

          {error && <p className="login-form__error" role="alert">{error}</p>}

          <button type="submit" className="login-form__submit" disabled={isSubmitting}>
            {isSubmitting ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
      </section>

      <aside
        className="login-showcase"
        aria-label={
          rememberedTrikomex
            ? `${rememberedCompany.name} üretim yönetimi`
            : 'Velora üretim yönetimi'
        }
      >
        <div className="login-showcase__image" />
        <div className="login-showcase__content">
          {rememberedTrikomex && rememberedCompany.logo && (
            <img
              className="login-showcase__brand-logo"
              src={rememberedCompany.logo}
              alt={`${rememberedCompany.name} logosu`}
            />
          )}
          <span className="login-showcase__eyebrow">
            {rememberedTrikomex ? rememberedCompany.name : 'Velora ERP'}
          </span>
          <h2>Üretiminizdeki her kritik karar tek ekranda.</h2>
          <p>
            Stok, sipariş, üretim ve finans akışlarını Velora ile net ve
            hızlı yönetin.
          </p>
          {rememberedTrikomex && (
            <p className="login-showcase__tagline">
              Meilleures Couleurs · Meilleurs Vêtements
            </p>
          )}
          <div className="login-showcase__stats">
            <div>
              <strong>Stok</strong>
              <span>anlık görünürlük</span>
            </div>
            <div>
              <strong>Üretim</strong>
              <span>kontrollü akış</span>
            </div>
            <div>
              <strong>Velora AI</strong>
              <span>doğal dil desteği</span>
            </div>
          </div>
        </div>
      </aside>
    </main>
  )
}
