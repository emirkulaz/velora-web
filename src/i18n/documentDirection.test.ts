import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyDocumentDirection, getUiTextDirection } from './documentDirection'
import { getActiveUiLanguage, setActiveUiLanguage } from './uiLanguage'

describe('documentDirection', () => {
  beforeEach(() => {
    setActiveUiLanguage('tr')
    document.documentElement.removeAttribute('dir')
    document.body.removeAttribute('dir')
    document.body.innerHTML = '<div id="root"></div>'
  })

  afterEach(() => {
    setActiveUiLanguage('tr')
  })

  it('tr / en / fr için ltr döner (içerik veya klavye değil)', () => {
    expect(getUiTextDirection('tr')).toBe('ltr')
    expect(getUiTextDirection('en')).toBe('ltr')
    expect(getUiTextDirection('fr')).toBe('ltr')
  })

  it('yalnız seçili dile bakar; input değerine bakmaz', () => {
    setActiveUiLanguage('tr')
    const input = document.createElement('input')
    input.value = 'مرحبا بالعالم'
    document.body.appendChild(input)

    expect(getUiTextDirection()).toBe('ltr')
    expect(getActiveUiLanguage()).toBe('tr')
    expect(applyDocumentDirection()).toBe('ltr')
    expect(document.documentElement.getAttribute('dir')).toBe('ltr')
    expect(document.body.getAttribute('dir')).toBe('ltr')
    expect(document.getElementById('root')?.getAttribute('dir')).toBe('ltr')
  })

  it('applyDocumentDirection .app için de ltr bırakır (container senkronu)', () => {
    const app = document.createElement('div')
    app.className = 'app'
    document.body.appendChild(app)
    applyDocumentDirection('tr')
    app.setAttribute('dir', getUiTextDirection('tr'))
    expect(app.getAttribute('dir')).toBe('ltr')
  })
})
