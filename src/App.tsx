import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { Icon } from './components/Icons'
import { SectionErrorBoundary } from './components/AppErrorBoundary'
import { LanguageSelector } from './components/LanguageSelector'
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
import { ApiError, SESSION_EXPIRED_EVENT, apiGet, apiPatch } from './data/api'
import { menuGroups, menuItems, type MenuId } from './data/demoData'
import { canAccessMenu, type AppUserRole } from './data/roles'
import { applyDocumentDirection, getUiTextDirection } from './i18n/documentDirection'
import { enforceLtrOnTree } from './i18n/enforceLtrFields'
import { useI18n } from './i18n/I18nProvider'
import { fileToAvatarDataUrl } from './utils/avatarImage'
import { renderModule } from './views'
import './App.css'

const AiCommandPanel = lazy(() =>
  import('./components/AiCommandPanel').then((module) => ({ default: module.AiCommandPanel })),
)
const ExchangeRateTicker = lazy(() =>
  import('./components/ExchangeRateTicker').then((module) => ({ default: module.ExchangeRateTicker })),
)
const MfaSetupPanel = lazy(() =>
  import('./components/MfaSetupPanel').then((module) => ({ default: module.MfaSetupPanel })),
)
const DailyWorkActions = lazy(() =>
  import('./views/DailyWorkActions').then((module) => ({ default: module.DailyWorkActions })),
)

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
  const { language, t, setLanguage } = useI18n()
  const [moduleRevision, setModuleRevision] = useState(0)
  const [activeMenu, setActiveMenu] = useState<MenuId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('vexor.theme') === 'dark')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const uiDir = getUiTextDirection(language)
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(
      localStorage.getItem('velora.accessToken') ??
        sessionStorage.getItem('velora.accessToken'),
    ),
  )
  const [authReady, setAuthReady] = useState(
    () =>
      !(
        localStorage.getItem('velora.accessToken') ??
          sessionStorage.getItem('velora.accessToken')
      ),
  )
  const [authError, setAuthError] = useState('')
  const [authAttempt, setAuthAttempt] = useState(0)
  const authRetryCountRef = useRef(0)
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
  const retryAuthentication = useCallback(() => {
    setAuthReady(false)
    setAuthError('')
    setAuthAttempt((value) => value + 1)
  }, [])

  const visibleMenuGroups = useMemo(
    () =>
      menuGroups
        .map((group) => ({
          ...group,
          items: group.items.flatMap((itemId) => {
            const item = menuItems.find((candidate) => candidate.id === itemId)
            return item && canAccessMenu(currentUser?.role, item.id) ? [item] : []
          }),
        }))
        .filter((group) => group.items.length > 0),
    [currentUser?.role],
  )

  useEffect(() => {
    applyDocumentDirection(language)
    enforceLtrOnTree(document)
  }, [language])

  useEffect(() => {
    if (!isAuthenticated) return
    let cancelled = false
    let retryId: number | undefined

    apiGet<CurrentUser>('/users/me')
      .then((user) => {
        if (cancelled) return
        authRetryCountRef.current = 0
        setCurrentUser(user)
        if (user.preferredLanguage) setLanguage(user.preferredLanguage)
        setActiveMenu(preferredMenu(user.role))
      })
      .catch((error: unknown) => {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 401) {
          clearSession()
          setCompanyPresentation(null)
          setIsAuthenticated(false)
          setCurrentUser(null)
          return
        }

        authRetryCountRef.current += 1
        setAuthError(t('startup.serverUnavailable'))
        if (authRetryCountRef.current <= 5) {
          const delayMs = Math.min(1_000 * 2 ** (authRetryCountRef.current - 1), 8_000)
          retryId = window.setTimeout(() => {
            if (!cancelled) retryAuthentication()
          }, delayMs)
        }
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
      if (retryId) window.clearTimeout(retryId)
    }
  }, [authAttempt, isAuthenticated, retryAuthentication, setLanguage, t])

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession()
      setCompanyPresentation(null)
      setIsAuthenticated(false)
      setCurrentUser(null)
      setAuthError('')
      authRetryCountRef.current = 0
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
    setAuthError('')
    authRetryCountRef.current = 0
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

  if (isAuthenticated && (!authReady || authError)) {
    return (
      <div className="app" dir={uiDir}>
        <StartupScreen
          error={authError || undefined}
          onRetry={authError ? retryAuthentication : undefined}
        />
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
          aria-label={t('common.closeMenu')}
          onClick={closeSidebar}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <VeloraLogo variant="full" theme="dark" />
        </div>

        <nav className="sidebar__nav" aria-label={t('nav.group.workspace')}>
          {visibleMenuGroups.map((group) => (
            <div className="nav-group" key={group.id}>
              <span className="nav-group__label">{t(group.labelKey)}</span>
              <div className="nav-group__items">
                {group.items.map((item) => (
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
              </div>
            </div>
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
              aria-label={t('common.openMenu')}
              onClick={() => setSidebarOpen(true)}
            >
              <Icon name="menu" />
            </button>
            <div className="header__title">
              <h1>{t(`nav.${activeMenu}`)}</h1>
              <p>{companyPresentation?.name ?? BRAND_NAME}</p>
            </div>
          </div>

          <div className="header__right">
            <LanguageSelector className="language-selector--header" />
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setDarkMode((enabled) => !enabled)}
              aria-label={darkMode ? t('common.lightMode') : t('common.darkMode')}
              aria-pressed={darkMode}
              title={darkMode ? t('common.lightMode') : t('common.darkMode')}
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
              </button>
              {notificationsOpen && (
                <div className="header-popover header-popover--notifications" role="dialog" aria-label={t('common.notifications')}>
                  <strong>{t('common.notifications')}</strong>
                  <p>{t('common.noNotifications')}</p>
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
                  {currentUser?.role === 'ADMIN' || currentUser?.role === 'OWNER' ? (
                    <Suspense fallback={null}>
                      <MfaSetupPanel />
                    </Suspense>
                  ) : null}
                  <button type="button" onClick={logout}>{t('common.logout')}</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          {activeMenu === 'overview' && (
            <SectionErrorBoundary resetKey="exchange-rates">
              <Suspense fallback={null}>
                <ExchangeRateTicker />
              </Suspense>
            </SectionErrorBoundary>
          )}
          <SectionErrorBoundary resetKey="ai-command-panel">
            <Suspense fallback={<p className="demo-notice">{t('common.loading')}</p>}>
              <AiCommandPanel key={currentUser?.email} userName={currentUser?.name} userRole={currentUser?.role} onRefresh={() => setModuleRevision((value) => value + 1)} />
            </Suspense>
          </SectionErrorBoundary>
          {activeMenu === 'dailyWork' && (
            <SectionErrorBoundary resetKey="daily-work-actions">
              <Suspense fallback={null}>
                <DailyWorkActions onNavigate={setActiveMenu} />
              </Suspense>
            </SectionErrorBoundary>
          )}
          <div className="module-area">
            <SectionErrorBoundary key={`${activeMenu}:${moduleRevision}`} resetKey={activeMenu}>
              <Suspense fallback={<p className="demo-notice">{t('common.loading')}</p>}>
              {renderModule(
                activeMenu,
                companyPresentation,
                currentUser?.role,
                setActiveMenu,
                t,
              )}
              </Suspense>
            </SectionErrorBoundary>
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
