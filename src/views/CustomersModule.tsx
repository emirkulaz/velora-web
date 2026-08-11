import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../data/api'

interface Customer {
  id: number
  name: string
  contactName: string | null
  taxNumber: string | null
  email: string | null
  phone: string | null
  country: string
  city: string | null
  address: string | null
  isActive: boolean
}

type CustomerForm = {
  name: string
  contactName: string
  taxNumber: string
  email: string
  phone: string
  country: string
  city: string
  address: string
}

const EMPTY_FORM: CustomerForm = {
  name: '',
  contactName: '',
  taxNumber: '',
  email: '',
  phone: '',
  country: 'Algeria',
  city: '',
  address: '',
}

function toPayload(form: CustomerForm, clearEmpty = false) {
  const optional = (value: string) =>
    value.trim() || (clearEmpty ? null : undefined)

  return {
    name: form.name.trim(),
    contactName: optional(form.contactName),
    taxNumber: optional(form.taxNumber),
    email: optional(form.email),
    phone: optional(form.phone),
    country: form.country.trim() || undefined,
    city: optional(form.city),
    address: optional(form.address),
  }
}

export function CustomersModule({
  canWrite = false,
  canDelete = false,
}: {
  canWrite?: boolean
  canDelete?: boolean
}) {
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)
  const [success, setSuccess] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const rows = await apiGet<Customer[]>('/customers')
      setCustomers(rows)
      setError('')
    } catch {
      setError('Müşteri verileri alınamadı.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
          (c.city?.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ??
            false) ||
          (c.contactName
            ?.toLocaleLowerCase('tr-TR')
            .includes(search.toLocaleLowerCase('tr-TR')) ??
            false),
      ),
    [customers, search],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (customer: Customer) => {
    setEditing(customer)
    setForm({
      name: customer.name,
      contactName: customer.contactName ?? '',
      taxNumber: customer.taxNumber ?? '',
      email: customer.email ?? '',
      phone: customer.phone ?? '',
      country: customer.country || 'Algeria',
      city: customer.city ?? '',
      address: customer.address ?? '',
    })
    setFormError('')
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    setSaving(true)
    setError('')
    setFormError('')
    setSuccess('')
    try {
      const payload = toPayload(form, Boolean(editing))
      if (editing) {
        await apiPatch(`/customers/${editing.id}`, payload)
        setSuccess('Müşteri güncellendi.')
      } else {
        await apiPost('/customers', payload)
        setSuccess('Yeni müşteri kaydedildi.')
      }
      setFormOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Müşteri kaydedilemedi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete) return
    setSaving(true)
    setError('')
    try {
      await apiDelete(`/customers/${deleteTarget.id}`)
      setDeleteTarget(null)
      await load()
      setSuccess('Müşteri silindi.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Müşteri silinemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={success} onDismiss={() => setSuccess('')} />
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Müşteri Listesi</h2>
          {canWrite && (
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreate}
              >
                + Yeni Müşteri
              </button>
            </div>
          )}
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Firma, şehir veya yetkili ara..."
        />
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && customers.length === 0 && canWrite && (
          <div className="empty-state empty-state--cta">
            <p>Henüz müşteri kaydı yok.</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreate}
            >
              + Yeni Müşteri
            </button>
          </div>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Yetkili</th>
                <th>Şehir</th>
                <th>Telefon</th>
                <th>E-posta</th>
                <th>Durum</th>
                {(canWrite || canDelete) && <th>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.contactName ?? '—'}</td>
                  <td>{c.city ?? '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>{c.email ?? '—'}</td>
                  <td>{c.isActive ? 'Aktif' : 'Pasif'}</td>
                  {(canWrite || canDelete) && (
                    <td>
                      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                        {canWrite && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => openEdit(c)}
                          >
                            Düzenle
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => setDeleteTarget(c)}
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!error && !loading && filtered.length === 0 && customers.length > 0 && (
                <tr>
                  <td colSpan={canWrite || canDelete ? 7 : 6}>
                    Arama kriterine uyan müşteri bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ModuleSummary
        items={[
          { label: 'Toplam Müşteri', value: loading ? '…' : String(customers.length) },
          {
            label: 'Aktif',
            value: loading
              ? '…'
              : String(customers.filter((customer) => customer.isActive).length),
          },
          {
            label: 'Pasif',
            value: loading
              ? '…'
              : String(customers.filter((customer) => !customer.isActive).length),
          },
          {
            label: 'Şehir',
            value: loading
              ? '…'
              : String(
                  new Set(customers.map((customer) => customer.city).filter(Boolean)).size,
                ),
          },
        ]}
      />

      <Modal
        open={formOpen}
        title={editing ? 'Müşteri Düzenle' : 'Yeni Müşteri'}
        onClose={() => setFormOpen(false)}
      >
        <form className="demo-form" onSubmit={(e) => void handleSubmit(e)}>
          {formError && (
            <p className="demo-notice" role="alert" style={{ margin: '0 0 12px' }}>
              {formError}
            </p>
          )}
          <label>
            Firma adı
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Yetkili
            <input
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            />
          </label>
          <label>
            Vergi no
            <input
              value={form.taxNumber}
              onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
            />
          </label>
          <label>
            Telefon
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label>
            E-posta
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label>
            Ülke
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </label>
          <label>
            Şehir
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </label>
          <label>
            Adres
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Müşteriyi sil"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" kalıcı olarak silinecek. Devam edilsin mi?`
            : ''
        }
        confirmLabel="Sil"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
