import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiGet, apiRequest } from '../data/api'

import { roleLabels, type AppUserRole } from '../data/roles'

type UserRole = AppUserRole

interface CompanyUser {
  id: number
  name: string
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
}

export function UsersModule() {
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadUsers = () => {
    apiGet<CompanyUser[]>('/users')
      .then(setUsers)
      .catch(() => setError('Kullanıcılar alınamadı.'))
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase('tr-TR')
    return users.filter((user) =>
      [user.name, user.email, roleLabels[user.role]]
        .some((value) => value.toLocaleLowerCase('tr-TR').includes(query)),
    )
  }, [search, users])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    setIsSubmitting(true)

    try {
      await apiRequest<CompanyUser>('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
          role: form.get('role'),
        }),
      })
      setFormOpen(false)
      loadUsers()
    } catch {
      setError('Kullanıcı oluşturulamadı. E-posta veya parola kurallarını kontrol edin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Toplam Kullanıcı', value: String(users.length) },
          { label: 'Aktif', value: String(users.filter((user) => user.isActive).length) },
          { label: 'Yönetici', value: String(users.filter((user) => user.role === 'ADMIN').length) },
          { label: 'Görüntüleyici', value: String(users.filter((user) => user.role === 'VIEWER').length) },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>TRIKOMEX Ekibi</h2>
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ad, e-posta veya rol ara..."
          actionLabel="+ Çalışan Ekle"
          onAction={() => setFormOpen(true)}
        />
        {error && <p className="demo-notice">{error}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>E-posta</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Oluşturulma</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{roleLabels[user.role]}</td>
                  <td>{user.isActive ? 'Aktif' : 'Pasif'}</td>
                  <td className="date-cell">{new Date(user.createdAt).toLocaleDateString('tr-TR')}</td>
                </tr>
              ))}
              {!error && filtered.length === 0 && (
                <tr><td colSpan={5}>Henüz çalışan hesabı bulunmuyor.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={formOpen} title="Çalışan Hesabı Ekle" onClose={() => setFormOpen(false)}>
        <form className="demo-form" onSubmit={submit}>
          <label>
            Ad soyad
            <input name="name" type="text" minLength={2} required />
          </label>
          <label>
            E-posta
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Geçici parola
            <input name="password" type="password" minLength={12} autoComplete="new-password" required />
          </label>
          <label>
            Rol
            <select name="role" defaultValue="MEMBER">
              <option value="MEMBER">Çalışan — günlük operasyonlar</option>
              <option value="VIEWER">Görüntüleyici — yalnızca okuma</option>
              <option value="ACCOUNTING_OPERATOR">Muhasebe Operatörü — finans ve cari</option>
              <option value="PRODUCTION_MANAGER">Üretim Müdürü — üretim ve stok</option>
              <option value="ADMIN">Yönetici — TRIKOMEX tam yetki</option>
              <option value="OWNER">Şirket Sahibi — tam yetki</option>
            </select>
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? 'Oluşturuluyor…' : 'Hesap Oluştur'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
