import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

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
  const { locale, t, formatNumber } = useI18n()
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await apiGet<Customer[]>('/customers')
      setCustomers(rows)
      setError('')
    } catch {
      setError(t('customers.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          c.name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)) ||
          (c.city?.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)) ??
            false) ||
          (c.contactName
            ?.toLocaleLowerCase(locale)
            .includes(search.toLocaleLowerCase(locale)) ??
            false),
      ),
    [customers, locale, search],
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
        setSuccess(t('customers.updated'))
      } else {
        await apiPost('/customers', payload)
        setSuccess(t('customers.created'))
      }
      setFormOpen(false)
      setEditing(null)
      setForm(EMPTY_FORM)
      await load()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t('customers.saveError'),
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
      setSuccess(t('customers.deleted'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('customers.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={success} onDismiss={() => setSuccess('')} />
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('customers.list')}</h2>
          {canWrite && (
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreate}
              >
                + {t('customers.new')}
              </button>
            </div>
          )}
        </div>
        <ModuleToolbar
          reportType="customers"
          reportLabel={t('customers.report')}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('customers.search')}
        />
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && customers.length === 0 && canWrite && (
          <div className="empty-state empty-state--cta">
            <p>{t('customers.empty')}</p>
            <button
              type="button"
              className="btn btn--primary"
              onClick={openCreate}
            >
              + {t('customers.new')}
            </button>
          </div>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('customers.company')}</th>
                <th>{t('customers.contact')}</th>
                <th>{t('customers.city')}</th>
                <th>{t('customers.phone')}</th>
                <th>{t('customers.email')}</th>
                <th>{t('customers.status')}</th>
                {(canWrite || canDelete) && <th>{t('customers.actions')}</th>}
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
                  <td>{c.isActive ? t('customers.active') : t('customers.inactive')}</td>
                  {(canWrite || canDelete) && (
                    <td>
                      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                        {canWrite && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => openEdit(c)}
                          >
                            {t('customers.edit')}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => setDeleteTarget(c)}
                          >
                            {t('customers.delete')}
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
                    {t('customers.noSearchResult')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ModuleSummary
        items={[
          { label: t('customers.total'), value: loading ? '…' : formatNumber(customers.length) },
          {
            label: t('customers.active'),
            value: loading
              ? '…'
              : formatNumber(customers.filter((customer) => customer.isActive).length),
          },
          {
            label: t('customers.inactive'),
            value: loading
              ? '…'
              : formatNumber(customers.filter((customer) => !customer.isActive).length),
          },
          {
            label: t('customers.city'),
            value: loading
              ? '…'
              : formatNumber(
                  new Set(customers.map((customer) => customer.city).filter(Boolean)).size,
                ),
          },
        ]}
      />

      <Modal
        open={formOpen}
        title={editing ? t('customers.editTitle') : t('customers.new')}
        onClose={() => setFormOpen(false)}
      >
        <form className="demo-form" onSubmit={(e) => void handleSubmit(e)}>
          {formError && (
            <p className="demo-notice" role="alert" style={{ margin: '0 0 12px' }}>
              {formError}
            </p>
          )}
          <label>
            {t('customers.companyName')}
            <input
              required
              minLength={2}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            {t('customers.contact')}
            <input
              value={form.contactName}
              onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
            />
          </label>
          <label>
            {t('customers.taxNumber')}
            <input
              value={form.taxNumber}
              onChange={(e) => setForm((f) => ({ ...f, taxNumber: e.target.value }))}
            />
          </label>
          <label>
            {t('customers.phone')}
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label>
            {t('customers.email')}
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </label>
          <label>
            {t('customers.country')}
            <input
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
            />
          </label>
          <label>
            {t('customers.city')}
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </label>
          <label>
            {t('customers.address')}
            <textarea
              rows={2}
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn--ghost" onClick={() => setFormOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t('customers.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('customers.deleteTitle')}
        message={
          deleteTarget
            ? t('customers.deleteConfirm', { name: deleteTarget.name })
            : ''
        }
        confirmLabel={t('customers.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
