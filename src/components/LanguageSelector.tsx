import { useI18n, type UiLanguage } from '../i18n/I18nProvider'

export function LanguageSelector({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useI18n()

  return (
    <label className={`language-selector ${className}`.trim()}>
      <select
        value={language}
        onChange={(event) => setLanguage(event.target.value as UiLanguage)}
        aria-label="Language"
      >
        <option value="tr">{t('language.tr')}</option>
        <option value="fr">{t('language.fr')}</option>
        <option value="en">{t('language.en')}</option>
      </select>
    </label>
  )
}
