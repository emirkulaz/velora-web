import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyDocumentDirection } from '../i18n/documentDirection'
import { startEnforceLtrFields } from '../i18n/enforceLtrFields'
import { setActiveUiLanguage } from '../i18n/uiLanguage'
import { AiCommandPanel } from './AiCommandPanel'
import { LoginScreen } from './LoginScreen'

describe('LTR form fields (tr)', () => {
  let stop: (() => void) | undefined

  beforeEach(() => {
    setActiveUiLanguage('tr')
    applyDocumentDirection('tr')
    stop = startEnforceLtrFields(document)
  })

  afterEach(() => {
    stop?.()
    stop = undefined
    vi.restoreAllMocks()
  })

  it('LoginScreen input dir=ltr kalır; yazınca ve rerender sonrası değişmez', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <LoginScreen rememberedCompany={null} onAuthenticated={() => undefined} />,
    )

    const loginInput = screen.getByLabelText(/^e-posta$/i)
    expect(loginInput).toHaveAttribute('dir', 'ltr')

    await user.type(loginInput, 'مرحبا@test.com')
    expect(loginInput).toHaveAttribute('dir', 'ltr')
    expect((loginInput as HTMLInputElement).value).toBe('مرحبا@test.com')

    loginInput.setAttribute('dir', 'rtl')
    loginInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(loginInput).toHaveAttribute('dir', 'ltr')

    rerender(<LoginScreen rememberedCompany={null} onAuthenticated={() => undefined} />)
    expect(screen.getByLabelText(/^e-posta$/i)).toHaveAttribute(
      'dir',
      'ltr',
    )
    expect(screen.getByLabelText(/^şifre$/i)).toHaveAttribute('dir', 'ltr')
  })

  it('AiCommandPanel textarea dir=ltr ve soldan yazılır; yazınca değişmez', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<AiCommandPanel />)

    const textarea = screen.getByLabelText(/vexor'a komut girin/i)
    expect(textarea).toHaveAttribute('dir', 'ltr')
    expect((textarea as HTMLTextAreaElement).style.textAlign).toBe('left')

    await user.type(textarea, 'كاشا bakiyesi')
    expect(textarea).toHaveAttribute('dir', 'ltr')
    expect((textarea as HTMLTextAreaElement).style.textAlign).toBe('left')
    expect((textarea as HTMLTextAreaElement).value).toContain('كاشا')

    textarea.setAttribute('dir', 'auto')
    await Promise.resolve()
    expect(textarea).toHaveAttribute('dir', 'ltr')

    rerender(<AiCommandPanel />)
    const again = screen.getByLabelText(/vexor'a komut girin/i)
    expect(again).toHaveAttribute('dir', 'ltr')
    expect((again as HTMLTextAreaElement).style.textAlign).toBe('left')
  })
})
