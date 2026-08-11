import { getActiveUiLanguage, setActiveUiLanguage } from './uiLanguage'

/**
 * Yön yalnızca uygulamanın seçili diline bağlıdır.
 * Input değeri, klavye veya içerik tahmini kullanılmaz.
 * tr / en / fr → ltr (Arapça bu düzeltmede etkinleştirilmez).
 */
export function getUiTextDirection(
  lang: string | null | undefined = getActiveUiLanguage(),
): 'ltr' | 'rtl' {
  const normalized = (lang || 'tr').trim().toLowerCase()
  if (normalized === 'ar' || normalized.startsWith('ar-')) {
    // Arapça modu bu aşamada geliştirilmiyor; TR arayüzü kalıcı LTR.
    // İleride ar seçildiğinde rtl dönecek — şimdilik ltr zorla.
    return 'ltr'
  }
  return 'ltr'
}

function setDir(el: HTMLElement | null | undefined, dir: 'ltr' | 'rtl') {
  if (!el) return
  el.setAttribute('dir', dir)
  el.style.direction = dir
}

/** html, body, #root senkronu. İçerikten yön tahmin etmez. */
export function applyDocumentDirection(
  lang: string | null | undefined = getActiveUiLanguage(),
): 'ltr' | 'rtl' {
  if (lang != null && String(lang).trim() !== '') {
    setActiveUiLanguage(lang)
  }

  const active = getActiveUiLanguage()
  const dir = getUiTextDirection(active)

  if (typeof document === 'undefined') return dir

  document.documentElement.lang = active || 'tr'
  setDir(document.documentElement, dir)
  setDir(document.body, dir)

  const root = document.getElementById('root')
  setDir(root, dir)

  return dir
}
