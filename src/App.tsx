import { useEffect, useMemo, useState } from 'react'
import { AiCommandPanel } from './components/AiCommandPanel'
import { ChangePasswordScreen } from './components/ChangePasswordScreen'
import { Icon } from './components/Icons'
import { LoginScreen } from './components/LoginScreen'
import { VeloraLogo } from './components/VeloraLogo'
import {
  clearLastCompanyPresentation,
  readLastCompanyPresentation,
  rememberCompanyPresentation,
  type CompanyPresentation,
} from './data/companyBranding'
import { ApiError, apiGet } from './data/api'
import { CRITICAL_ALERTS, menuItems, menuTitles, type MenuId } from './data/demoData'
import { canAccessMenu, roleLabels, type AppUserRole } from './data/roles'
import { renderModule } from './views'
import './App.css'

interface CurrentUser {
  name: string
  email: string
  role: AppUserRole
  mustChangePassword?: boolean
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
  const [activeMenu, setActiveMenu] = useState<MenuId>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(
    () =>
      Boolean(
        localStorage.getItem('velora.accessToken') ??
        sessionStorage.getItem('velora.accessToken'),
      ),
  )
  const [companyPresentation, setCompanyPresentation] = useState<CompanyPresentation | null>(
    readLastCompanyPresentation,
  )
  const [mustChangePassword, setMustChangePassword] = useState(false)

  const closeSidebar = () => setSidebarOpen(false)
  const closeHeaderMenus = () => {
    setNotificationsOpen(false)
    setProfileOpen(false)
  }

  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => canAccessMenu(currentUser?.role, item.id)),
    [currentUser?.role],
  )

  useEffect(() => {
    if (!isAuthenticated) return

    apiGet<CurrentUser>('/users/me')
      .then((user) => {
        setCurrentUser(user)
        setMustChangePassword(Boolean(user.mustChangePassword))
        setActiveMenu((current) =>
          canAccessMenu(user.role, current) ? current : 'overview',
        )
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 401) {
          localStorage.removeItem('velora.accessToken')
          sessionStorage.removeItem('velora.accessToken')
          clearLastCompanyPresentation()
          setCompanyPresentation(null)
          setIsAuthenticated(false)
          setMustChangePassword(false)
        }
      })

    apiGet<unknown>('/companies')
      .then((company) => {
        const presentation = rememberCompanyPresentation(company)
        if (presentation) setCompanyPresentation(presentation)
      })
      .catch(() => {
        // Keep the last safe presentation when the optional company refresh fails.
      })
  }, [isAuthenticated])

  const logout = () => {
    localStorage.removeItem('velora.accessToken')
    sessionStorage.removeItem('velora.accessToken')
    clearLastCompanyPresentation()
    setCompanyPresentation(null)
    closeHeaderMenus()
    setIsAuthenticated(false)
    setMustChangePassword(false)
    setCurrentUser(null)
  }

  if (!isAuthenticated) {
    return (
      <LoginScreen
        rememberedCompany={companyPresentation}
        onAuthenticated={(company, options) => {
          setCompanyPresentation(company)
          setMustChangePassword(Boolean(options?.mustChangePassword))
          setIsAuthenticated(true)
        }}
      />
    )
  }

  if (mustChangePassword) {
    return (
      <ChangePasswordScreen
        onChanged={() => {
          setMustChangePassword(false)
          apiGet<CurrentUser>('/users/me').then(setCurrentUser).catch(() => undefined)
        }}
      />
    )
  }

  return (
    <div className="dashboard">
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
              <span className="nav-item__label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="company-badge">
            <span className="company-badge__name">
              {companyPresentation?.name ?? 'Velora'}
            </span>
            <span className="company-badge__currency">
              Para birimi: {companyPresentation?.currency ?? '—'}
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
            <div className="header__title">
              <h1>{menuTitles[activeMenu]}</h1>
              <p>
                Ağustos 2026 · {companyPresentation?.name ?? 'Velora'}
              </p>
            </div>
          </div>

          <div className="header__right">
            <VeloraLogo variant="full" theme="light" className="header-brand" />
            <div className="header-action">
              <button
                type="button"
                className="icon-btn"
                aria-label="Bildirimler"
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
                <div className="header-popover header-popover--notifications" role="dialog" aria-label="Bildirimler">
                  <strong>Bildirimler</strong>
                  {CRITICAL_ALERTS.length === 0 ? (
                    <p>Yeni bildirim yok.</p>
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
                className="user-avatar"
                aria-label="Profil menüsü"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((open) => !open)
                  setNotificationsOpen(false)
                }}
              >
                {currentUser ? initials(currentUser.name) : '…'}
              </button>
              {profileOpen && (
                <div className="header-popover header-popover--profile" role="dialog" aria-label="Profil menüsü">
                  <strong>{currentUser?.name ?? 'Hesabınız'}</strong>
                  <span>{currentUser?.email ?? 'Profil yükleniyor…'}</span>
                  <span>
                    {currentUser?.role
                      ? roleLabels[currentUser.role]
                      : '—'}
                  </span>
                  <button type="button" onClick={logout}>Çıkış yap</button>
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
          <AiCommandPanel />
          <div className="module-area">{renderModule(activeMenu, companyPresentation)}</div>
        </main>
      </div>
    </div>
  )
}

export default App
