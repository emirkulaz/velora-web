import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyDocumentDirection } from './documentDirection'
import {
  enforceLtrOnField,
  enforceLtrOnTree,
  startEnforceLtrFields,
} from './enforceLtrFields'
import { setActiveUiLanguage } from './uiLanguage'

describe('enforceLtrFields', () => {
  let stop: (() => void) | undefined

  beforeEach(() => {
    setActiveUiLanguage('tr')
    applyDocumentDirection('tr')
    document.body.innerHTML = ''
  })

  afterEach(() => {
    stop?.()
    stop = undefined
    document.body.innerHTML = ''
  })

  it('Türkçe dilde metin/arama sola, number sağa; dir=ltr kalır', () => {
    const input = document.createElement('input')
    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'module-toolbar__search'
    const textarea = document.createElement('textarea')
    const ai = document.createElement('textarea')
    ai.className = 'ai-command__input'
    const number = document.createElement('input')
    number.type = 'number'
    document.body.append(input, search, textarea, ai, number)

    enforceLtrOnTree(document)

    expect(input.getAttribute('dir')).toBe('ltr')
    expect(search.getAttribute('dir')).toBe('ltr')
    expect(textarea.getAttribute('dir')).toBe('ltr')
    expect(ai.getAttribute('dir')).toBe('ltr')
    expect(number.getAttribute('dir')).toBe('ltr')
    expect(input.style.textAlign).toBe('left')
    expect(search.style.textAlign).toBe('left')
    expect(textarea.style.textAlign).toBe('left')
    expect(ai.style.textAlign).toBe('left')
    expect(number.style.textAlign).toBe('right')
  })

  it('yazarken ve focus sonrası dir RTL olmaz; metin input sola kalır', () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    stop = startEnforceLtrFields(document)

    input.focus()
    input.value = 'مرحبا'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.setAttribute('dir', 'rtl')
    input.style.textAlign = 'right'
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

    enforceLtrOnField(input)
    expect(input.getAttribute('dir')).toBe('ltr')
    expect(input.style.textAlign).toBe('left')

    // MutationObserver dir değişimini geri alır
    input.setAttribute('dir', 'auto')
    return new Promise<void>((resolve) => {
      queueMicrotask(() => {
        expect(input.getAttribute('dir')).toBe('ltr')
        resolve()
      })
    })
  })

  it('AI komut textarea focus sonrası sola hizalı kalır', () => {
    const ai = document.createElement('textarea')
    ai.className = 'ai-command__input'
    document.body.appendChild(ai)
    stop = startEnforceLtrFields(document)

    ai.style.textAlign = 'right'
    ai.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    enforceLtrOnField(ai)

    expect(ai.getAttribute('dir')).toBe('ltr')
    expect(ai.style.textAlign).toBe('left')
  })

  it('rerender benzeri yeniden eklemede dir ltr kalır', async () => {
    stop = startEnforceLtrFields(document)
    const host = document.createElement('div')
    document.body.appendChild(host)

    host.innerHTML = '<textarea></textarea>'
    await vi.waitFor(() => {
      expect(host.querySelector('textarea')!.getAttribute('dir')).toBe('ltr')
    })

    host.innerHTML = '<textarea></textarea>'
    const second = host.querySelector('textarea')!
    enforceLtrOnTree(host)
    expect(second.getAttribute('dir')).toBe('ltr')
    expect(second.style.textAlign).toBe('left')
    second.value = '١٢٣ اختبار'
    expect(second.getAttribute('dir')).toBe('ltr')
  })
})
