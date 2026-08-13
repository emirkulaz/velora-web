import { useEffect, useRef, useState } from 'react'
import { useI18n, type UiLanguage } from '../i18n/I18nProvider'

const LANGUAGES: UiLanguage[] = ['tr', 'fr', 'en']

function LanguageFlag({ code }: { code: UiLanguage }) {
  if (code === 'tr') {
    return (
      <svg className="language-selector__flag" viewBox="0 0 24 16" aria-hidden="true">
        <rect width="24" height="16" fill="#E30A17" />
        <circle cx="10" cy="8" r="4.1" fill="#fff" />
        <circle cx="11.35" cy="8" r="3.25" fill="#E30A17" />
        <polygon
          fill="#fff"
          points="13.35,8 15.55,8.75 13.95,7.05 13.95,8.95 15.55,7.25"
        />
      </svg>
    )
  }
  if (code === 'fr') {
    return (
      <svg className="language-selector__flag" viewBox="0 0 24 16" aria-hidden="true">
        <rect width="8" height="16" fill="#002395" />
        <rect x="8" width="8" height="16" fill="#fff" />
        <rect x="16" width="8" height="16" fill="#ED2939" />
      </svg>
    )
  }
  return (
    <svg className="language-selector__flag" viewBox="0 0 24 16" aria-hidden="true">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 L24 16 M24 0 L0 16" stroke="#fff" strokeWidth="3.2" />
      <path d="M0 0 L24 16 M24 0 L0 16" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M12 0 V16 M0 8 H24" stroke="#fff" strokeWidth="5.2" />
      <path d="M12 0 V16 M0 8 H24" stroke="#C8102E" strokeWidth="3" />
    </svg>
  )
}

export function LanguageSelector({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className={`language-selector ${className}`.trim()} ref={rootRef}>
      <button
        type="button"
        className="language-selector__button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <LanguageFlag code={language} />
        <span>{t(`language.${language}`)}</span>
      </button>
      {open && (
        <ul className="language-selector__menu" role="listbox" aria-label="Language">
          {LANGUAGES.map((code) => (
            <li key={code} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={code === language}
                className={code === language ? 'is-active' : undefined}
                onClick={() => {
                  setLanguage(code)
                  setOpen(false)
                }}
              >
                <LanguageFlag code={code} />
                <span>{t(`language.${code}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
