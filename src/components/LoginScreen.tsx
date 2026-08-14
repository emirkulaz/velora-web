import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  clearLastCompanyPresentation,
  isRememberedTrikomex,
  rememberCompanyPresentation,
  type CompanyPresentation,
} from '../data/companyBranding'
import {
  getQuickLoginAccounts,
  isQuickLoginEnabled,
  type QuickLoginAccount,
} from '../data/quickLoginAccounts'
import { useI18n } from '../i18n/I18nProvider'
import { LanguageSelector } from './LanguageSelector'
import { VeloraLogo } from './VeloraLogo'
import './LoginScreen.css'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
const REMEMBERED_LOGIN_KEY = 'velora.rememberedLogin'

interface LoginScreenProps {
  rememberedCompany: CompanyPresentation | null
  onAuthenticated: (
    company: CompanyPresentation | null,
  ) => void
}

export function LoginScreen({
  rememberedCompany,
  onAuthenticated,
}: LoginScreenProps) {
  const { t } = useI18n()
  const rememberedLogin = localStorage.getItem(REMEMBERED_LOGIN_KEY) ?? ''
  const [login, setLogin] = useState(rememberedLogin)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [rememberUsername, setRememberUsername] = useState(rememberedLogin.length > 0)
  const rememberedTrikomex = isRememberedTrikomex(rememberedCompany)
  const showQuickLogin = isQuickLoginEnabled()
  const quickAccounts = showQuickLogin ? getQuickLoginAccounts() : []

  const authenticate = async (identifierRaw: string, passwordValue: string) => {
    setError('')
    setIsSubmitting(true)

    try {
      const identifier = identifierRaw.trim()
      const payload = identifier.includes('@')
        ? { email: identifier, password: passwordValue }
        : { login: identifier, password: passwordValue }

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Giriş yapılamadı.')
      }

      const { accessToken } = (await response.json()) as {
        accessToken: string
      }
      const tokenStorage = rememberMe ? localStorage : sessionStorage
      const otherStorage = rememberMe ? sessionStorage : localStorage
      tokenStorage.setItem('velora.accessToken', accessToken)
      otherStorage.removeItem('velora.accessToken')
      if (rememberUsername) {
        localStorage.setItem(REMEMBERED_LOGIN_KEY, identifier)
      } else {
        localStorage.removeItem(REMEMBERED_LOGIN_KEY)
      }
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

      onAuthenticated(company)
    } catch {
      setError(t('login.error'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await authenticate(login, password)
  }

  const handleQuickLogin = async (account: QuickLoginAccount) => {
    setLogin(account.identifier)
    setPassword(account.password)
    await authenticate(account.identifier, account.password)
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__language">
          <LanguageSelector />
        </div>
        <div className="login-panel__brand-row">
          <VeloraLogo variant="full" theme="light" className="login-brand" />
          <img
            className="login-panel__emblem"
            src="/vexor-emblem.png"
            alt="VEXOR"
          />
        </div>
        <div className="login-panel__heading">
          <p className="login-panel__eyebrow">
            {rememberedTrikomex ? `${rememberedCompany.name} · VEXOR ERP` : 'VEXOR ERP'}
          </p>
          <h1 id="login-title">{t('login.title')}</h1>
          <p>
            {rememberedTrikomex
              ? `${rememberedCompany.name} operasyonlarını güvenle yönetin.`
              : t('login.description')}
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            {t('login.email')}
            <input
              type="text"
              dir="ltr"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            {t('login.password')}
            <input
              type="password"
              dir="ltr"
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
            <span>{t('login.remember')}</span>
          </label>
          <label className="login-form__remember">
            <input
              type="checkbox"
              checked={rememberUsername}
              onChange={(event) => setRememberUsername(event.target.checked)}
            />
            <span>{t('login.rememberUsername')}</span>
          </label>

          {error && <p className="login-form__error" role="alert">{error}</p>}

          <button type="submit" className="login-form__submit" disabled={isSubmitting}>
            {isSubmitting ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </section>

      {showQuickLogin && quickAccounts.length > 0 ? (
        <aside className="demo-login" aria-label={t('login.quick.title')}>
          <div className="demo-login__heading">
            <span>{t('login.quick.eyebrow')}</span>
            <h2>{t('login.quick.title')}</h2>
            <p>{t('login.quick.description')}</p>
          </div>
          <div className="demo-company-grid">
            {quickAccounts.map((account) => (
              <button
                key={account.id}
                type="button"
                className="demo-company-card"
                disabled={isSubmitting}
                onClick={() => void handleQuickLogin(account)}
              >
                {account.logoClass ? (
                  <span className={`demo-company-card__logo ${account.logoClass}`} />
                ) : null}
                <strong>{account.label}</strong>
                <span>{account.description}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : (
        <aside
          className="login-showcase"
          aria-label={
            rememberedTrikomex
              ? `${rememberedCompany.name} üretim yönetimi`
              : 'VEXOR üretim yönetimi'
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
              {rememberedTrikomex ? rememberedCompany.name : 'VEXOR ERP'}
            </span>
            <h2>Üretiminizdeki her kritik karar tek ekranda.</h2>
            <p>
              Stok, sipariş, üretim ve finans akışlarını VEXOR ile net ve
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
                <strong>VEXOR AI</strong>
                <span>doğal dil desteği</span>
              </div>
            </div>
          </div>
        </aside>
      )}
    </main>
  )
}
