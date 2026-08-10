import { useState } from 'react'
import type { FormEvent } from 'react'
import { VeloraLogo } from './VeloraLogo'
import './LoginScreen.css'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

interface ChangePasswordScreenProps {
  onChanged: () => void
}

export function ChangePasswordScreen({ onChanged }: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Yeni parola ile tekrarı eşleşmiyor.')
      return
    }

    if (newPassword.length < 12) {
      setError('Yeni parola en az 12 karakter olmalıdır.')
      return
    }

    const accessToken =
      localStorage.getItem('velora.accessToken') ??
      sessionStorage.getItem('velora.accessToken')

    if (!accessToken) {
      setError('Oturum bulunamadı. Lütfen yeniden giriş yapın.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (!response.ok) {
        throw new Error('Parola değiştirilemedi.')
      }

      onChanged()
    } catch {
      setError('Parola değiştirilemedi. Mevcut parolayı kontrol edin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="change-password-title">
        <VeloraLogo variant="full" theme="light" />
        <div className="login-panel__heading">
          <p className="login-panel__eyebrow">Velora ERP</p>
          <h1 id="change-password-title">Parolanızı değiştirin</h1>
          <p>İlk girişte geçici parolayı değiştirmeniz zorunludur.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            Mevcut parola
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            Yeni parola
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          <label>
            Yeni parola (tekrar)
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              required
            />
          </label>
          {error && <p className="login-form__error">{error}</p>}
          <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Kaydediliyor…' : 'Parolayı Kaydet'}
          </button>
        </form>
      </section>
    </main>
  )
}
