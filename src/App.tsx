import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { AiCommandPanel } from './components/AiCommandPanel'
import { ExchangeRateTicker } from './components/ExchangeRateTicker'
import { Icon } from './components/Icons'
import { LanguageSelector } from './components/LanguageSelector'
import { MfaSetupPanel } from './components/MfaSetupPanel'
import { LoginScreen } from './components/LoginScreen'
import { StartupScreen } from './components/StartupScreen'
import { BRAND_NAME, VeloraLogo } from './components/VeloraLogo'
import {
  clearLastCompanyPresentation,
  readLastCompanyPresentation,
  rememberCompanyPresentation,
  resolveCompanyLogo,
  type CompanyPresentation,
} from './data/companyBranding'
import { SESSION_EXPIRED_EVENT, apiGet, apiPatch } from './data/api'
import { CRITICAL_ALERTS, menuItems, type MenuId } from './data/demoData'
import { canAccessMenu, type AppUserRole } from './data/roles'
import { applyDocumentDirection, getUiTextDirection } from './i18n/documentDirection'
import { enforceLtrOnTree } from './i18n/enforceLtrFields'
import { getActiveUiLanguage } from './i18n/uiLanguage'
import { useI18n } from './i18n/I18nProvider'
import { fileToAvatarDataUrl } from './utils/avatarImage'
import { DailyWorkActions } from './views/DailyWorkModule'
import { renderModule } from './views'
import './App.css'

interface CurrentUser {
  name: string
  email: string
  role: AppUserRole
  preferredLanguage?: 'tr' | 'fr' | 'en'
  avatarUrl?: string | null
}

function clearSession() {
  localStorage.removeItem('velora.accessToken')
  sessionStorage.removeItem('velora.accessToken')
  clearLastCompanyPresentation()
}

function preferredMenu(role: AppUserRole): MenuId {
  return role === 'ACCOUNTING_OPERATOR' || role === 'ACCOUNTING_OPERATIONS'
    ? 'dailyWork'
    : 'overview'
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function App() {
  const { t, setLanguage } = useI18n()
  const [activeMenu, setActiveMenu] = useState<MenuId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('vexor.theme') === 'dark')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [uiDir, setUiDir] = useState<'ltr' | 'rtl'>(() =>
    getUiTextDirection(getActiveUiLanguage()),
  )
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(
      localStorage.getItem('velora.accessToken') ??
        sessionStorage.getItem('velora.accessToken'),
    ),
  )
  const [authReady, setAuthReady] = useState(
    () =>
      !Boolean(
        localStorage.getItem('velora.accessToken') ??
          sessionStorage.getItem('velora.accessToken'),
      ),
  )
  const [companyPresentation, setCompanyPresentation] = useState<CompanyPresentation | null>(
    readLastCompanyPresentation,
  )

  const closeSidebar = () => setSidebarOpen(false)

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('vexor.theme', darkMode ? 'dark' : 'light')
  }, [darkMode])
  const closeHeaderMenus = () => {
    setNotificationsOpen(false)
    setProfileOpen(false)
  }

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => canAccessMenu(currentUser?.role, item.id)),
    [currentUser?.role],
  )

  useEffect(() => {
    setUiDir(applyDocumentDirection(getActiveUiLanguage()))
    enforceLtrOnTree(document)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    setAuthReady(false)

    apiGet<CurrentUser>('/users/me')
      .then((user) => {
        if (cancelled) return
        setCurrentUser(user)
        if (user.preferredLanguage) setLanguage(user.preferredLanguage)
        setActiveMenu(preferredMenu(user.role))
      })
      .catch(() => {
        if (cancelled) return
        clearSession()
        setCompanyPresentation(null)
        setIsAuthenticated(false)
        setCurrentUser(null)
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true)
      })

    void apiGet<unknown>('/companies')
      .then((company) => {
        const presentation = rememberCompanyPresentation(company)
        if (presentation) setCompanyPresentation(presentation)
      })
      .catch(() => {
        // Keep the last safe presentation when the optional company refresh fails.
      })
    return () => {
      cancelled = true
    }
  }, [isAuthenticated])

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession()
      setCompanyPresentation(null)
      setIsAuthenticated(false)
      setCurrentUser(null)
      setAuthReady(true)
      closeHeaderMenus()
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  const logout = () => {
    clearSession()
    setCompanyPresentation(null)
    closeHeaderMenus()
    setIsAuthenticated(false)
    setCurrentUser(null)
    setAuthReady(true)
  }

  const saveAvatar = async (avatarUrl: string | null) => {
    setAvatarBusy(true)
    setAvatarError('')
    try {
      const updated = await apiPatch<CurrentUser>('/users/me', { avatarUrl })
      setCurrentUser(updated)
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : t('profile.photoError'),
      )
    } finally {
      setAvatarBusy(false)
    }
  }

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setAvatarBusy(true)
    setAvatarError('')
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      const updated = await apiPatch<CurrentUser>('/users/me', { avatarUrl: dataUrl })
      setCurrentUser(updated)
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : t('profile.photoError'),
      )
    } finally {
      setAvatarBusy(false)
    }
  }

  if (isAuthenticated && !authReady) {
    return (
      <div className="app" dir={uiDir}>
        <StartupScreen />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="app" dir={uiDir}>
        <LoginScreen
          rememberedCompany={companyPresentation}
          onAuthenticated={(company) => {
            setCompanyPresentation(company)
            setAuthReady(false)
            setIsAuthenticated(true)
          }}
        />
      </div>
    )
  }

  return (
    <div className="app dashboard" dir={uiDir}>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Menüyü kapat"
          onClick={closeSidebar}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <VeloraLogo variant="full" theme="dark" />
        </div>

        <nav className="sidebar__nav">
          {visibleMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activeMenu === item.id ? 'nav-item--active' : ''}`}
              onClick={() => {
                setActiveMenu(item.id)
                closeSidebar()
                closeHeaderMenus()
              }}
            >
              <span className="nav-item__icon">
                <Icon name={item.icon} />
              </span>
              <span className="nav-item__label">{t(`nav.${item.id}`)}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="company-badge">
            {resolveCompanyLogo(companyPresentation) && (
              <img
                className="company-badge__logo"
                src={resolveCompanyLogo(companyPresentation)!}
                alt={companyPresentation?.name ?? 'Trikomex'}
              />
            )}
            <span className="company-badge__name">
              {companyPresentation?.name ?? BRAND_NAME}
            </span>
            <span className="company-badge__currency">
              {t('common.currency')}: {companyPresentation?.currency ?? '—'}
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div className="header__left">
            <button
              type="button"
              className="menu-toggle"
              aria-label="Menüyü aç"
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <LanguageSelector className="language-selector--header" />
          </div>

          <div className="header__right">
            <VeloraLogo variant="full" theme="light" className="header-brand" />
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setDarkMode((enabled) => !enabled)}
              aria-label={darkMode ? 'Açık moda geç' : 'Koyu moda geç'}
              aria-pressed={darkMode}
              title={darkMode ? 'Açık moda geç' : 'Koyu moda geç'}
            >
              <span aria-hidden="true">{darkMode ? '☀' : '◐'}</span>
            </button>
            <div className="header-action">
              <button
                type="button"
                className="icon-btn"
                aria-label={t('common.notifications')}
                aria-expanded={notificationsOpen}
                onClick={() => {
                  setNotificationsOpen((open) => !open)
                  setProfileOpen(false)
                }}
              >
                <Icon name="bell" />
                {CRITICAL_ALERTS.length > 0 && (
                  <span className="icon-btn__badge">{CRITICAL_ALERTS.length}</span>
                )}
              </button>
              {notificationsOpen && (
                <div className="header-popover header-popover--notifications" role="dialog" aria-label={t('common.notifications')}>
                  <strong>{t('common.notifications')}</strong>
                  {CRITICAL_ALERTS.length === 0 ? (
                    <p>{t('common.noNotifications')}</p>
                  ) : (
                    <ul>
                      {CRITICAL_ALERTS.map((alert) => (
                        <li key={alert.id}>{alert.text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="header-action">
              <button
                type="button"
                className={`user-avatar${currentUser?.avatarUrl ? ' user-avatar--photo' : ''}`}
                aria-label={t('common.profile')}
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((open) => !open)
                  setNotificationsOpen(false)
                  setAvatarError('')
                }}
              >
                {currentUser?.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" />
                ) : currentUser ? (
                  initials(currentUser.name)
                ) : (
                  '…'
                )}
              </button>
              {profileOpen && (
                <div className="header-popover header-popover--profile" role="dialog" aria-label={t('common.profile')}>
                  <strong>{currentUser?.name ?? '—'}</strong>
                  <span>{currentUser?.email ?? t('common.loading')}</span>
                  <span>
                    {currentUser?.role
                      ? t(`role.${currentUser.role}`)
                      : '—'}
                  </span>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="visually-hidden"
                    onChange={(event) => void handleAvatarFileChange(event)}
                  />
                  <button
                    type="button"
                    className="header-popover__action"
                    disabled={avatarBusy}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {avatarBusy ? t('profile.photoUpdating') : t('profile.changePhoto')}
                  </button>
                  {currentUser?.avatarUrl ? (
                    <button
                      type="button"
                      className="header-popover__action header-popover__action--muted"
                      disabled={avatarBusy}
                      onClick={() => void saveAvatar(null)}
                    >
                      {t('profile.removePhoto')}
                    </button>
                  ) : null}
                  {avatarError ? (
                    <p className="header-popover__error" role="alert">
                      {avatarError}
                    </p>
                  ) : null}
                  {currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER' ? <MfaSetupPanel /> : null}
                  <button type="button" onClick={logout}>{t('common.logout')}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        {CRITICAL_ALERTS.length > 0 && (
          <div className="alerts-bar">
            <span className="alerts-bar__label">Dikkat</span>
            <div className="alerts-bar__items">
              {CRITICAL_ALERTS.map((alert) => (
                <button key={alert.id} type="button" className="alert-chip">
                  {alert.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="content">
          {activeMenu === 'overview' && <ExchangeRateTicker />}
          <AiCommandPanel userName={currentUser?.name} />
          {activeMenu === 'dailyWork' && (
            <DailyWorkActions onNavigate={setActiveMenu} />
          )}
          <div className="module-area">
            {renderModule(
              activeMenu,
              companyPresentation,
              currentUser?.role,
              setActiveMenu,
            )}
          </div>
          <footer className="content-credit" aria-label="Credits">
            Created by Emir Kulaz
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
