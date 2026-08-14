import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiGet, apiPatch, apiPost, apiRequest } from '../data/api'
import { roleLabels, type AppUserRole } from '../data/roles'
import { useI18n } from '../i18n/I18nProvider'

type CompanyUser = {
  id: number
  name: string
  email: string | null
  role: AppUserRole
  isActive: boolean
  createdAt: string
  preferredLanguage?: 'tr' | 'fr' | 'en'
}

export function UserManagementModule() {
  const { language, t } = useI18n()
  const [users, setUsers] = useState<CompanyUser[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingUser, setEditingUser] = useState<CompanyUser | null>(null)
  const [passwordUser, setPasswordUser] = useState<CompanyUser | null>(null)
  const [passwordNotice, setPasswordNotice] = useState('')

  const loadUsers = () => {
    setError('')
    apiGet<CompanyUser[]>('/users')
      .then(setUsers)
      .catch(() => setError('Kullanıcı hesapları alınamadı.'))
  }

  useEffect(loadUsers, [])

  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase('tr-TR')
    return users.filter((user) =>
      [user.name, user.email ?? '', roleLabels[user.role]].some((value) =>
        value.toLocaleLowerCase('tr-TR').includes(query),
      ),
    )
  }, [search, users])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError('')
    setIsSubmitting(true)
    try {
      if (editingUser) {
        await apiPatch<CompanyUser>(`/users/${editingUser.id}`, {
          name: form.get('name'),
          email: form.get('email'),
          role: form.get('role'),
          isActive: form.get('isActive') === 'on',
        })
      } else {
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
      }
      setFormOpen(false)
      setEditingUser(null)
      loadUsers()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Kullanıcı kaydedilemedi.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const openCreateForm = () => {
    setEditingUser(null)
    setFormOpen(true)
  }

  const openEditForm = (user: CompanyUser) => {
    setEditingUser(user)
    setFormOpen(true)
  }

  const closeForm = () => {
    if (isSubmitting) return
    setFormOpen(false)
    setEditingUser(null)
  }

  const submitPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!passwordUser) return
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    const confirmation = String(form.get('passwordConfirmation') ?? '')
    setError('')
    setPasswordNotice('')
    if (password !== confirmation) {
      setError(t('users.passwordMismatch'))
      return
    }
    setIsSubmitting(true)
    try {
      await apiPost(`/users/${passwordUser.id}/password`, { password })
      setPasswordNotice(t('users.passwordSaved', { name: passwordUser.name }))
      setPasswordUser(null)
      loadUsers()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('users.passwordSaveError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <ModuleSummary items={[
        { label: 'Toplam Kullanıcı', value: String(users.length) },
        { label: 'Aktif Hesap', value: String(users.filter((user) => user.isActive).length) },
        { label: 'Yönetici', value: String(users.filter((user) => user.role === 'ADMIN').length) },
        { label: 'Salt Okunur', value: String(users.filter((user) => user.role === 'VIEWER').length) },
      ]} />
      <section className="panel panel--full">
        <div className="panel__header"><div><h2>Kullanıcı Yönetimi</h2><p>VEXOR’a giriş yapabilen hesaplar ve yetkileri</p></div></div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ad, e-posta veya rol ara..."
          actionLabel="+ Kullanıcı Ekle"
          onAction={openCreateForm}
        />
        {error && <p className="demo-notice" role="alert">{error}</p>}
        {passwordNotice && <p className="demo-notice" role="status">{passwordNotice}</p>}
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Ad</th><th>E-posta</th><th>Yetki Rolü</th><th>Durum</th><th>Oluşturulma</th><th>İşlem</th></tr></thead>
          <tbody>
            {filtered.map((user) => <tr key={user.id}><td><strong>{user.name}</strong></td><td>{user.email ?? '—'}</td><td>{t(`role.${user.role}`)}</td><td>{user.isActive ? t('users.active') : t('users.inactive')}</td><td className="date-cell">{new Date(user.createdAt).toLocaleDateString(language === 'fr' ? 'fr-DZ' : language === 'en' ? 'en-GB' : 'tr-TR')}</td><td className="row-actions"><button type="button" onClick={() => openEditForm(user)}>{t('users.edit')}</button>{user.isActive && <button type="button" onClick={() => { setError(''); setPasswordNotice(''); setPasswordUser(user) }}>{t('users.setPassword')}</button>}</td></tr>)}
            {!error && filtered.length === 0 && <tr><td colSpan={6}>Henüz kullanıcı hesabı bulunmuyor.</td></tr>}
          </tbody>
        </table></div>
      </section>
      <Modal open={formOpen} title={editingUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Hesabı'} onClose={closeForm}>
        <form key={editingUser?.id ?? 'new'} className="demo-form" onSubmit={submit}>
          <label>Ad soyad<input name="name" type="text" minLength={2} defaultValue={editingUser?.name ?? ''} required /></label>
          <label>E-posta<input name="email" type="email" autoComplete="email" defaultValue={editingUser?.email ?? ''} required /></label>
          {!editingUser && <label>{t('users.password')}<input name="password" type="password" minLength={16} autoComplete="new-password" required /></label>}
          <label>Yetki rolü<select name="role" defaultValue={editingUser?.role ?? 'VIEWER'}>
            <option value="VIEWER">Görüntüleyici — yalnızca okuma</option>
            <option value="MEMBER">Operasyon kullanıcısı</option>
            <option value="ACCOUNTING_OPERATOR">Muhasebe Operatörü — finans ve cari</option>
            <option value="ACCOUNTING_OPERATIONS">Muhasebe &amp; Operasyon — günlük operasyon ve finans</option>
            <option value="PRODUCTION_MANAGER">Üretim Müdürü — üretim ve stok</option>
            <option value="ADMIN">Yönetici — tam yetki</option>
            <option value="OWNER">Şirket Sahibi — tam şirket yetkisi</option>
          </select></label>
          {editingUser && <label><input name="isActive" type="checkbox" defaultChecked={editingUser.isActive} /> Aktif kullanıcı</label>}
          <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={closeForm}>Vazgeç</button><button type="submit" className="btn btn--primary" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : editingUser ? 'Değişiklikleri Kaydet' : 'Kullanıcı Oluştur'}</button></div>
        </form>
      </Modal>
      <Modal open={Boolean(passwordUser)} title={t('users.setPassword')} onClose={() => { if (!isSubmitting) setPasswordUser(null) }}>
        <form key={passwordUser?.id ?? 'password'} className="demo-form" onSubmit={submitPassword}>
          <p>{t('users.passwordDescription', { name: passwordUser?.name ?? '' })}</p>
          <label>{t('users.password')}<input name="password" type="password" minLength={16} maxLength={128} autoComplete="new-password" required /></label>
          <label>{t('users.passwordConfirm')}<input name="passwordConfirmation" type="password" minLength={16} maxLength={128} autoComplete="new-password" required /></label>
          <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={() => setPasswordUser(null)} disabled={isSubmitting}>{t('common.cancel')}</button><button type="submit" className="btn btn--primary" disabled={isSubmitting}>{isSubmitting ? t('users.passwordSaving') : t('users.passwordSave')}</button></div>
        </form>
      </Modal>
    </>
  )
}
