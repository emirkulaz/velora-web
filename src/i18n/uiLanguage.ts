/** Uygulamanın seçili arayüz dili. Tarayıcı klavyesi / input içeriği kullanılmaz. */
let activeUiLanguage = 'tr'

export function getActiveUiLanguage(): string {
  return activeUiLanguage
}

export function setActiveUiLanguage(lang: string): void {
  const normalized = (lang || 'tr').trim().toLowerCase() || 'tr'
  activeUiLanguage = normalized
}
