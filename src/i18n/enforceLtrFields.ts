import { getUiTextDirection } from './documentDirection'

const FIELD_SELECTOR = 'input, textarea'

function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
}

function isNumberLikeField(el: HTMLInputElement | HTMLTextAreaElement): boolean {
  if (!(el instanceof HTMLInputElement)) return false
  const type = (el.getAttribute('type') || el.type || 'text').toLowerCase()
  return type === 'number' || type === 'tel'
}

function resolveLtrTextAlign(el: HTMLInputElement | HTMLTextAreaElement): 'left' | 'right' {
  // Sayı / telefon sağda kalabilir; arama ve metin alanları soldan LTR yazılır
  if (isNumberLikeField(el)) return 'right'
  return 'left'
}

/** Seçili dil LTR iken input/textarea dir=ltr kalıcı tutar; hizayı alan tipine göre seçer. */
export function enforceLtrOnField(el: HTMLInputElement | HTMLTextAreaElement): void {
  if (getUiTextDirection() !== 'ltr') return
  if (el.getAttribute('dir') === 'auto') {
    el.removeAttribute('dir')
  }
  el.setAttribute('dir', 'ltr')
  // İçerik / tarayıcı auto-detect yüzünden yön kaymasını engelle
  el.style.direction = 'ltr'
  el.style.textAlign = resolveLtrTextAlign(el)
  el.style.unicodeBidi = 'normal'
}

export function enforceLtrOnTree(root: ParentNode = document): void {
  if (getUiTextDirection() !== 'ltr') return
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(FIELD_SELECTOR).forEach((el) => {
    enforceLtrOnField(el)
  })
}

/**
 * Yeni eklenen alanlar ve focus/rerender sonrası dir=ltr kalır.
 * İçeriğe bakarak yön değiştirmez.
 */
export function startEnforceLtrFields(root: ParentNode = document): () => void {
  enforceLtrOnTree(root)

  const onFocusIn = (event: Event) => {
    if (isTextField(event.target)) {
      enforceLtrOnField(event.target)
    }
  }

  const doc = root instanceof Document ? root : root.ownerDocument
  doc?.addEventListener('focusin', onFocusIn, true)

  const observer =
    typeof MutationObserver !== 'undefined'
      ? new MutationObserver((mutations) => {
          if (getUiTextDirection() !== 'ltr') return
          for (const mutation of mutations) {
            if (mutation.type === 'attributes' && isTextField(mutation.target)) {
              const current = mutation.target.getAttribute('dir')
              if (current !== 'ltr') {
                enforceLtrOnField(mutation.target)
              }
              continue
            }
            mutation.addedNodes.forEach((node) => {
              if (isTextField(node)) {
                enforceLtrOnField(node)
                return
              }
              if (node instanceof Element) {
                node
                  .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(FIELD_SELECTOR)
                  .forEach(enforceLtrOnField)
              }
            })
          }
        })
      : null

  if (observer && root instanceof Node) {
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['dir'],
    })
  }

  return () => {
    doc?.removeEventListener('focusin', onFocusIn, true)
    observer?.disconnect()
  }
}
