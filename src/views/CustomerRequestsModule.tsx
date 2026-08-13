import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { StatusBadge } from '../components/StatusBadge'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiRequest } from '../data/api'

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

const OPEN_CREATE_FLAG = 'velora.customerRequests.openCreate'

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Yeni',
  REVIEWING: 'İnceleniyor',
  QUOTED: 'Teklifli',
  CONVERTED_TO_ORDER: 'Siparişe dönüştü',
  CANCELLED: 'İptal',
}

const METHOD_LABELS: Record<string, string> = {
  PHONE: 'Telefon',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-posta',
  IN_PERSON: 'Yüz yüze',
  OTHER: 'Diğer',
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

  const load = async () => {
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
          : 'Talepler yüklenemedi. Migration uygulanmış mı ve yetkiniz var mı kontrol edin.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    if (!q) return rows
    return rows.filter(
      (row) =>
        (row.customerName ?? '').toLocaleLowerCase('tr-TR').includes(q) ||
        row.requestText.toLocaleLowerCase('tr-TR').includes(q) ||
        (row.requestedProduct ?? '').toLocaleLowerCase('tr-TR').includes(q) ||
        (STATUS_LABELS[row.status] ?? row.status)
          .toLocaleLowerCase('tr-TR')
          .includes(q),
    )
  }, [rows, query])

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
    try {
      if (sessionStorage.getItem(OPEN_CREATE_FLAG) === '1') {
        sessionStorage.removeItem(OPEN_CREATE_FLAG)
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
      }
    } catch {
      // ignore storage errors
    }
  }, [canWrite])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!customerId) {
      setFormError('Önce müşteriyi seçin.')
      return
    }
    if (!requestText.trim()) {
      setFormError('Görüşme / talep metnini girin.')
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
      setSuccessNotice('Yeni talep kaydedildi.')
      await load()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Talep kaydedilemedi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const requestConvert = (row: CustomerRequest) => {
    if (!canConvertRequest(row)) {
      setError(
        'Siparişe dönüştürmek için miktar, birim ve teklif birim fiyatı gerekli. Bunları talep oluştururken girin veya önce kaydı tamamlayın.',
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
        err instanceof ApiError ? err.message : 'Siparişe dönüştürülemedi.',
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
      setSuccessNotice('Talep durumu güncellendi.')
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Talep durumu güncellenemedi.',
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
          <h2>Müşteri Talepleri / Görüşmeler</h2>
          {canWrite && (
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreate}
              >
                + Yeni Talep
              </button>
            </div>
          )}
        </div>

        {!loading && !error && rows.length === 0 && (
          <div className="empty-state empty-state--cta">
            <p>Kayıtlı talep yok.</p>
            {canWrite && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={openCreate}
              >
                + Yeni Talep
              </button>
            )}
          </div>
        )}

        <p className="empty-state" style={{ marginBottom: 12 }}>
          Yeni talep → müşteri seç → görüşme ve talep bilgilerini gir → kaydet →
          listede gör → istenirse siparişe dönüştür.
        </p>

        <ModuleToolbar
          reportType="requests"
          reportLabel="Talep Raporu"
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Müşteri, ürün veya talep metni ara…"
        />

        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          rows.length > 0 ? (
            <p className="empty-state">Arama kriterine uyan talep bulunamadı.</p>
          ) : null
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Müşteri</th>
                  <th>Kanal</th>
                  <th>Talep</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>{row.contactDate.split('-').reverse().join('.')}</td>
                    <td>{row.customerName ?? row.customerId}</td>
                    <td>
                      {METHOD_LABELS[row.contactMethod] ?? row.contactMethod}
                    </td>
                    <td title={row.requestText}>
                      {row.requestText.length > 60
                        ? `${row.requestText.slice(0, 57)}…`
                        : row.requestText}
                    </td>
                    <td>
                      <StatusBadge
                        status={STATUS_LABELS[row.status] ?? row.status}
                      />
                    </td>
                    <td>
                      {canWrite &&
                        row.status !== 'CONVERTED_TO_ORDER' &&
                        row.status !== 'CANCELLED' && (
                          <select
                            aria-label={`${row.customerName ?? 'Müşteri'} talep durumu`}
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
                            <option value="NEW">Yeni</option>
                            <option value="REVIEWING">İnceleniyor</option>
                            <option value="QUOTED">Teklifli</option>
                            <option value="CANCELLED">İptal</option>
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
                                ? 'Taslak sipariş oluştur'
                                : 'Miktar, birim ve teklif fiyatı gerekli'
                            }
                            onClick={() => requestConvert(row)}
                          >
                            Siparişe dönüştür
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
          { label: 'Toplam talep', value: String(summary.total) },
          { label: 'Açık', value: String(summary.open) },
          { label: 'Siparişe dönen', value: String(summary.converted) },
          { label: 'Bugün', value: String(summary.today) },
        ]}
      />

      <Modal
        open={formOpen}
        title="Yeni müşteri talebi"
        onClose={() => {
          setFormOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCreate(e)}>
          <p className="empty-state" style={{ marginBottom: 4 }}>
            1) Müşteriyi seç → 2) Görüşme ve talep bilgilerini gir → 3) Kaydet
          </p>

          <fieldset className="demo-form__fieldset">
            <legend>1. Müşteri</legend>
            {customers.length === 0 ? (
              <p className="demo-notice" role="status">
                Önce Müşteriler menüsünden bir müşteri ekleyin.
              </p>
            ) : (
              <label>
                Müşteri
                <select
                  required
                  dir="ltr"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Seçin</option>
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
            <legend>2. Görüşme ve talep</legend>
            <label>
              Görüşme tarihi
              <input
                type="date"
                required
                dir="ltr"
                value={contactDate}
                onChange={(e) => setContactDate(e.target.value)}
              />
            </label>
            <label>
              Kanal
              <select
                dir="ltr"
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
              >
                <option value="PHONE">Telefon</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">E-posta</option>
                <option value="IN_PERSON">Yüz yüze</option>
                <option value="OTHER">Diğer</option>
              </select>
            </label>
            <label>
              Talep metni
              <textarea
                required
                rows={3}
                dir="ltr"
                value={requestText}
                onChange={(e) => setRequestText(e.target.value)}
                placeholder="Müşterinin istediği ürün / miktar / renk vb."
              />
            </label>
            <label>
              İstenen ürün
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
              En (cm)
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
              Renk sayısı
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
              Tahmini miktar
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
              Birim
              <select
                dir="ltr"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="METER">Metre</option>
                <option value="PIECE">Adet</option>
                <option value="KILOGRAM">Kilogram</option>
              </select>
            </label>
            <label>
              İstenen teslim
              <input
                type="date"
                dir="ltr"
                value={requestedDeliveryDate}
                onChange={(e) => setRequestedDeliveryDate(e.target.value)}
              />
            </label>
            <label>
              Teklif birim fiyat (DZD)
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
              Siparişe dönüştürmek için miktar, birim ve teklif fiyatı gerekir.
            </p>
            <label>
              Notlar
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
              Vazgeç
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || customers.length === 0}
            >
              {saving ? 'Kaydediliyor…' : '3. Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={convertId != null}
        title="Siparişe dönüştür"
        message={
          convertTarget
            ? `${convertTarget.customerName ?? 'Müşteri'} talebi taslak siparişe dönüşecek. Aynı talep ikinci kez dönüştürülemez. Devam?`
            : 'Talep metni korunarak taslak sipariş oluşturulacak. Devam?'
        }
        confirmLabel="Dönüştür"
        onCancel={() => setConvertId(null)}
        onConfirm={() => void handleConvert()}
      />
    </>
  )
}

/** Günlük İşler → Yeni müşteri talebi için create modalını açar. */
export function markOpenCustomerRequestCreate(): void {
  try {
    sessionStorage.setItem(OPEN_CREATE_FLAG, '1')
  } catch {
    // ignore
  }
}
