import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { StatusBadge } from '../components/StatusBadge'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiRequest } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'
import { OPEN_CUSTOMER_REQUEST_CREATE_FLAG } from './customerRequestActions'

type CustomerOption = { id: number; name: string }
type ProductOption = { id: number; code: string; name: string }

type CustomerRequest = {
  id: number
  customerId: number
  customerName: string | null
  contactDate: string
  contactMethod: string
  requestText: string
  requestedProduct: string | null
  widthCm: number | null
  colorCount: number | null
  estimatedQuantity: number | null
  unit: string | null
  requestedDeliveryDate: string | null
  quotedUnitPrice: number | null
  notes: string | null
  status: string
  convertedOrder: {
    id: number
    orderNumber: string
    status: string
  } | null
}

function todayYmd(): string {
  const now = new Date()
  const algiers = new Date(
    now.toLocaleString('en-US', { timeZone: 'Africa/Algiers' }),
  )
  const y = algiers.getFullYear()
  const m = String(algiers.getMonth() + 1).padStart(2, '0')
  const d = String(algiers.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function canConvertRequest(row: CustomerRequest): boolean {
  return (
    row.status !== 'CONVERTED_TO_ORDER' &&
    row.status !== 'CANCELLED' &&
    row.estimatedQuantity != null &&
    Number(row.estimatedQuantity) > 0 &&
    Boolean(row.unit) &&
    row.quotedUnitPrice != null &&
    Number(row.quotedUnitPrice) >= 0
  )
}

export function CustomerRequestsModule({
  canWrite = false,
}: {
  canWrite?: boolean
}) {
  const { locale, t, formatDate, formatNumber } = useI18n()
  const [rows, setRows] = useState<CustomerRequest[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [convertId, setConvertId] = useState<number | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [contactDate, setContactDate] = useState(todayYmd())
  const [contactMethod, setContactMethod] = useState('PHONE')
  const [requestText, setRequestText] = useState('')
  const [requestedProduct, setRequestedProduct] = useState('')
  const [widthCm, setWidthCm] = useState('')
  const [colorCount, setColorCount] = useState('')
  const [estimatedQuantity, setEstimatedQuantity] = useState('')
  const [unit, setUnit] = useState('METER')
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState('')
  const [quotedUnitPrice, setQuotedUnitPrice] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [requestRows, customerRows, productRows] = await Promise.all([
        apiGet<CustomerRequest[]>('/customer-requests'),
        apiGet<Array<{ id: number; name: string }>>('/customers'),
        apiGet<ProductOption[]>('/products').catch(() => [] as ProductOption[]),
      ])
      setRows(requestRows)
      setCustomers(customerRows.map((c) => ({ id: c.id, name: c.name })))
      setProducts(productRows)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('requests.loadError'),
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(locale)
    if (!q) return rows
    return rows.filter(
      (row) =>
        (row.customerName ?? '').toLocaleLowerCase(locale).includes(q) ||
        row.requestText.toLocaleLowerCase(locale).includes(q) ||
        (row.requestedProduct ?? '').toLocaleLowerCase(locale).includes(q) ||
        t(`requests.status.${row.status}`)
          .toLocaleLowerCase(locale)
          .includes(q),
    )
  }, [locale, query, rows, t])

  const today = todayYmd()
  const summary = {
    open: rows.filter((r) =>
      ['NEW', 'REVIEWING', 'QUOTED'].includes(r.status),
    ).length,
    converted: rows.filter((r) => r.status === 'CONVERTED_TO_ORDER').length,
    total: rows.length,
    today: rows.filter((r) => r.contactDate === today).length,
  }

  const resetForm = () => {
    setCustomerId('')
    setContactDate(todayYmd())
    setContactMethod('PHONE')
    setRequestText('')
    setRequestedProduct('')
    setWidthCm('')
    setColorCount('')
    setEstimatedQuantity('')
    setUnit('METER')
    setRequestedDeliveryDate('')
    setQuotedUnitPrice('')
    setNotes('')
    setFormError('')
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  useEffect(() => {
    if (!canWrite) return
    let shouldOpen = false
    try {
      if (sessionStorage.getItem(OPEN_CUSTOMER_REQUEST_CREATE_FLAG) === '1') {
        sessionStorage.removeItem(OPEN_CUSTOMER_REQUEST_CREATE_FLAG)
        shouldOpen = true
      }
    } catch {
      // ignore storage errors
    }
    if (!shouldOpen) return
    const timeoutId = window.setTimeout(() => {
        setCustomerId('')
        setContactDate(todayYmd())
        setContactMethod('PHONE')
        setRequestText('')
        setRequestedProduct('')
        setWidthCm('')
        setColorCount('')
        setEstimatedQuantity('')
        setUnit('METER')
        setRequestedDeliveryDate('')
        setQuotedUnitPrice('')
        setNotes('')
        setFormError('')
        setFormOpen(true)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [canWrite])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!customerId) {
      setFormError(t('requests.selectCustomerError'))
      return
    }
    if (!requestText.trim()) {
      setFormError(t('requests.textRequired'))
      return
    }
    setSaving(true)
    setFormError('')
    setError('')
    setSuccessNotice('')
    try {
      await apiRequest('/customer-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: Number(customerId),
          contactDate,
          contactMethod,
          requestText: requestText.trim(),
          requestedProduct: requestedProduct.trim() || undefined,
          widthCm: widthCm ? Number(widthCm) : undefined,
          colorCount: colorCount ? Number(colorCount) : undefined,
          estimatedQuantity: estimatedQuantity
            ? Number(estimatedQuantity)
            : undefined,
          unit: estimatedQuantity ? unit : undefined,
          requestedDeliveryDate: requestedDeliveryDate || undefined,
          quotedUnitPrice: quotedUnitPrice
            ? Number(quotedUnitPrice)
            : undefined,
          notes: notes.trim() || undefined,
        }),
      })
      setFormOpen(false)
      resetForm()
      setSuccessNotice(t('requests.created'))
      await load()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t('requests.saveError'),
      )
    } finally {
      setSaving(false)
    }
  }

  const requestConvert = (row: CustomerRequest) => {
    if (!canConvertRequest(row)) {
      setError(
        t('requests.convertRequirements'),
      )
      return
    }
    setError('')
    setConvertId(row.id)
  }

  const handleConvert = async () => {
    if (convertId == null || !canWrite) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/customer-requests/${convertId}/convert-to-order`, {
        method: 'POST',
      })
      setConvertId(null)
      await load()
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('requests.convertError'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleStatusChange = async (
    row: CustomerRequest,
    status: 'NEW' | 'REVIEWING' | 'QUOTED' | 'CANCELLED',
  ) => {
    if (!canWrite || saving || status === row.status) return
    setSaving(true)
    setError('')
    try {
      await apiRequest(`/customer-requests/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await load()
      setSuccessNotice(t('requests.statusUpdated'))
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('requests.statusUpdateError'),
      )
    } finally {
      setSaving(false)
    }
  }

  const convertTarget = rows.find((r) => r.id === convertId) ?? null

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('requests.title')}</h2>
          {canWrite && (
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreate}
              >
                + {t('requests.new')}
              </button>
            </div>
          )}
        </div>

        {!loading && !error && rows.length === 0 && (
          <div className="empty-state empty-state--cta">
            <p>{t('requests.empty')}</p>
            {canWrite && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreate}
              >
                + {t('requests.new')}
              </button>
            )}
          </div>
        )}

        <p className="empty-state" style={{ marginBottom: 12 }}>
          {t('requests.workflow')}
        </p>

        <ModuleToolbar
          reportType="requests"
          reportLabel={t('requests.report')}
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder={t('requests.search')}
        />

        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="empty-state">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          rows.length > 0 ? (
            <p className="empty-state">{t('requests.noSearchResult')}</p>
          ) : null
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('requests.date')}</th>
                  <th>{t('requests.customer')}</th>
                  <th>{t('requests.channel')}</th>
                  <th>{t('requests.request')}</th>
                  <th>{t('requests.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(`${row.contactDate}T12:00:00`)}</td>
                    <td>{row.customerName ?? row.customerId}</td>
                    <td>
                      {t(`requests.method.${row.contactMethod}`)}
                    </td>
                    <td title={row.requestText}>
                      {row.requestText.length > 60
                        ? `${row.requestText.slice(0, 57)}…`
                        : row.requestText}
                    </td>
                    <td>
                      <StatusBadge
                        status={t(`requests.status.${row.status}`)}
                      />
                    </td>
                    <td>
                      {canWrite &&
                        row.status !== 'CONVERTED_TO_ORDER' &&
                        row.status !== 'CANCELLED' && (
                          <select
                            aria-label={t('requests.statusAria', { name: row.customerName ?? t('requests.customer') })}
                            value={row.status}
                            disabled={saving}
                            onChange={(event) =>
                              void handleStatusChange(
                                row,
                                event.target.value as
                                  | 'NEW'
                                  | 'REVIEWING'
                                  | 'QUOTED'
                                  | 'CANCELLED',
                              )
                            }
                          >
                            <option value="NEW">{t('requests.status.NEW')}</option>
                            <option value="REVIEWING">{t('requests.status.REVIEWING')}</option>
                            <option value="QUOTED">{t('requests.status.QUOTED')}</option>
                            <option value="CANCELLED">{t('requests.status.CANCELLED')}</option>
                          </select>
                        )}
                      {canWrite &&
                        row.status !== 'CONVERTED_TO_ORDER' &&
                        row.status !== 'CANCELLED' && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            title={
                              canConvertRequest(row)
                                ? t('requests.createDraft')
                                : t('requests.missingQuote')
                            }
                            onClick={() => requestConvert(row)}
                          >
                            {t('requests.convert')}
                          </button>
                        )}
                      {row.convertedOrder && (
                        <span className="mono">
                          {row.convertedOrder.orderNumber}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModuleSummary
        items={[
          { label: t('requests.total'), value: formatNumber(summary.total) },
          { label: t('requests.open'), value: formatNumber(summary.open) },
          { label: t('requests.converted'), value: formatNumber(summary.converted) },
          { label: t('requests.today'), value: formatNumber(summary.today) },
        ]}
      />

      <Modal
        open={formOpen}
        title={t('requests.newTitle')}
        onClose={() => {
          setFormOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCreate(e)}>
          <p className="empty-state" style={{ marginBottom: 4 }}>
            {t('requests.formWorkflow')}
          </p>

          <fieldset className="demo-form__fieldset">
            <legend>{t('requests.customerStep')}</legend>
            {customers.length === 0 ? (
              <p className="demo-notice" role="status">
                {t('requests.addCustomerFirst')}
              </p>
            ) : (
              <label>
                {t('requests.customer')}
                <select
                  required
                  dir="ltr"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">{t('requests.select')}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </fieldset>

          <fieldset className="demo-form__fieldset">
            <legend>{t('requests.detailsStep')}</legend>
            <label>
              {t('requests.contactDate')}
              <input
                type="date"
                required
                dir="ltr"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
              />
            </label>
            <label>
              {t('requests.channel')}
              <select
                dir="ltr"
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
              >
                <option value="PHONE">{t('requests.method.PHONE')}</option>
                <option value="WHATSAPP">{t('requests.method.WHATSAPP')}</option>
                <option value="EMAIL">{t('requests.method.EMAIL')}</option>
                <option value="IN_PERSON">{t('requests.method.IN_PERSON')}</option>
                <option value="OTHER">{t('requests.method.OTHER')}</option>
              </select>
            </label>
            <label>
              {t('requests.text')}
              <textarea
                required
                rows={3}
                dir="ltr"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                placeholder={t('requests.textPlaceholder')}
              />
            </label>
            <label>
              {t('requests.requestedProduct')}
              <input
                dir="ltr"
                list="customer-request-products"
                value={requestedProduct}
                onChange={(e) => setRequestedProduct(e.target.value)}
              />
              <datalist id="customer-request-products">
                {products.map((product) => (
                  <option key={product.id} value={product.name}>
                    {product.code}
                  </option>
                ))}
              </datalist>
            </label>
            <label>
              {t('requests.width')}
              <input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                value={widthCm}
                onChange={(e) => setWidthCm(e.target.value)}
              />
            </label>
            <label>
              {t('requests.colorCount')}
              <input
                type="number"
                min="0"
                step="1"
                dir="ltr"
                value={colorCount}
                onChange={(e) => setColorCount(e.target.value)}
              />
            </label>
            <label>
              {t('requests.estimatedQuantity')}
              <input
                type="number"
                min="0.001"
                step="0.001"
                dir="ltr"
                value={estimatedQuantity}
                onChange={(e) => setEstimatedQuantity(e.target.value)}
              />
            </label>
            <label>
              {t('requests.unit')}
              <select
                dir="ltr"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="METER">{t('requests.unit.METER')}</option>
                <option value="PIECE">{t('requests.unit.PIECE')}</option>
                <option value="KILOGRAM">{t('requests.unit.KILOGRAM')}</option>
              </select>
            </label>
            <label>
              {t('requests.requestedDelivery')}
              <input
                type="date"
                dir="ltr"
                value={requestedDeliveryDate}
                onChange={(e) => setRequestedDeliveryDate(e.target.value)}
              />
            </label>
            <label>
              {t('requests.quotedUnitPrice')}
              <input
                type="number"
                min="0"
                step="0.01"
                dir="ltr"
                value={quotedUnitPrice}
                onChange={(e) => setQuotedUnitPrice(e.target.value)}
              />
            </label>
            <p className="empty-state" style={{ margin: 0 }}>
              {t('requests.convertHint')}
            </p>
            <label>
              {t('requests.notes')}
              <textarea
                rows={2}
                dir="ltr"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>
          </fieldset>

          {formError && (
            <p className="demo-notice" role="alert">
              {formError}
            </p>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setFormOpen(false)
                setFormError('')
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || customers.length === 0}
            >
              {saving ? t('requests.saving') : t('requests.saveStep')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={convertId != null}
        title={t('requests.convertTitle')}
        message={
          convertTarget
            ? t('requests.convertConfirm', { name: convertTarget.customerName ?? t('requests.customer') })
            : t('requests.convertFallback')
        }
        confirmLabel={t('requests.confirmConvert')}
        onCancel={() => setConvertId(null)}
        onConfirm={() => void handleConvert()}
      />
    </>
  )
}
