import { describe, expect, it } from 'vitest'
import { translations, type UiLanguage } from './I18nProvider'

const languages: UiLanguage[] = ['tr', 'fr', 'en']

describe('translation catalog', () => {
  it('uses the same key set for every supported language', () => {
    const referenceKeys = Object.keys(translations.tr).sort()

    for (const language of languages) {
      expect(Object.keys(translations[language]).sort()).toEqual(referenceKeys)
    }
  })

  it('does not contain blank translations', () => {
    for (const language of languages) {
      for (const [key, value] of Object.entries(translations[language])) {
        expect(value.trim(), `${language}.${key}`).not.toBe('')
      }
    }
  })
})
