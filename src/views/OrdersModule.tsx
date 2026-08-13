import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { StatusBadge } from '../components/StatusBadge'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiPost, apiRequest } from '../data/api'
import { algiersDatetimeLocal, algiersYmd } from '../data/dates'

const OPEN_CREATE_FLAG = 'velora.orders.openCreate'

type CustomerOption = { id: number; name: string }
type ProductOption = { id:number; code:string; name:string; unit:'METER'|'PIECE'|'KILOGRAM'; salePrice:number|null }

type SalesOrder = {
  id: number
  customerId: number
  customerName: string | null
  productId: number | null
  productName: string | null
  orderNumber: string
  orderDate: string
  expectedDeliveryDate: string | null
  status: string
  widthCm: number | null
  colorCount: number | null
  quantity: number
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
  unitPrice: number
  grossTotal: number
  advanceAmount: number
  collectedAmount: number
  remainingAmount: number
  currency: string
  notes: string | null
  deliveredQuantity: number
  deliveries: Array<{
    id: number
    deliveryDate: string | null
    quantity: number
    notes: string | null
  }>
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak',
  CONFIRMED: 'Onaylı',
  IN_PRODUCTION: 'Üretimde',
  READY: 'Hazır',
  PARTIALLY_DELIVERED: 'Kısmi teslim',
  DELIVERED: 'Teslim edildi',
  CANCELLED: 'İptal',
}

function formatMoney(value: number, currency = 'DZD'): string {
  const fixed = Number(value.toFixed(2))
  const [intRaw, dec] = Math.abs(fixed).toFixed(2).split('.')
  const withDots = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sign = fixed < 0 ? '-' : ''
  if (dec === '00') return `${sign}${withDots} ${currency}`
  return `${sign}${withDots},${dec} ${currency}`
}

function todayYmd(): string {
  return algiersYmd()
}

function nowDatetimeLocal(): string {
  return algiersDatetimeLocal()
}

function toIsoDateTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value.length === 10 ? `${value}T00:00:00.000Z` : value
  }
  return parsed.toISOString()
}

export function OrdersModule({ canWrite = false }: { canWrite?: boolean }) {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selected, setSelected] = useState<SalesOrder | null>(null)
  const [confirmConfirm, setConfirmConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [successNotice, setSuccessNotice] = useState('')

  const [customerId, setCustomerId] = useState('')
  const [productId, setProductId] = useState('')
  const [orderDate, setOrderDate] = useState(todayYmd())
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unit, setUnit] = useState<'METER' | 'PIECE' | 'KILOGRAM'>('METER')
  const [unitPrice, setUnitPrice] = useState('0')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [widthCm, setWidthCm] = useState('')
  const [colorCount, setColorCount] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'DRAFT' | 'CONFIRMED'>('DRAFT')

  const [deliveryDate, setDeliveryDate] = useState(todayYmd())
  const [deliveryQty, setDeliveryQty] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')
  const [collectionAmount, setCollectionAmount] = useState('')
  const [collectionAt, setCollectionAt] = useState(nowDatetimeLocal())
  const [collectionDesc, setCollectionDesc] = useState('')
  const [extraAdvanceAmount, setExtraAdvanceAmount] = useState('')
  const [extraAdvanceAt, setExtraAdvanceAt] = useState(nowDatetimeLocal())
  const [extraAdvanceDesc, setExtraAdvanceDesc] = useState('')

  const liveGross = useMemo(() => {
    const q = Number(quantity) || 0
    const p = Number(unitPrice) || 0
    return Math.round(q * p * 100) / 100
  }, [quantity, unitPrice])

  const liveRemaining = useMemo(() => {
    const adv = Number(advanceAmount) || 0
    return Math.round((liveGross - adv) * 100) / 100
  }, [liveGross, advanceAmount])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [orderRows, customerRows, productRows] = await Promise.all([
        apiGet<SalesOrder[]>('/orders'),
        apiGet<Array<{ id: number; name: string }>>('/customers'),
        apiGet<ProductOption[]>('/products'),
      ])
      setOrders(orderRows)
      setCustomers(customerRows.map((c) => ({ id: c.id, name: c.name })))
      setProducts(productRows)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Siparişler yüklenemedi. Yetki veya API bağlantısını kontrol edin.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (selectedId == null) {
      setSelected(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const row = await apiGet<SalesOrder>(`/orders/${selectedId}`)
        if (!cancelled) setSelected(row)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : 'Sipariş detayı alınamadı.',
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const filtered = orders.filter((order) => {
    const q = query.trim().toLocaleLowerCase('tr-TR')
    if (!q) return true
    return (
      order.orderNumber.toLocaleLowerCase('tr-TR').includes(q) ||
      (order.customerName ?? '').toLocaleLowerCase('tr-TR').includes(q) ||
      order.status.toLocaleLowerCase('tr-TR').includes(q)
    )
  })

  const summary = {
    total: orders.length,
    inProduction: orders.filter((o) => o.status === 'IN_PRODUCTION').length,
    draft: orders.filter((o) => o.status === 'DRAFT').length,
    monthAmount: orders
      .filter((o) => o.orderDate.slice(0, 7) === todayYmd().slice(0, 7))
      .reduce((sum, o) => sum + o.grossTotal, 0),
  }

  const resetForm = () => {
    setCustomerId('')
    setProductId('')
    setOrderDate(todayYmd())
    setExpectedDeliveryDate('')
    setQuantity('1')
    setUnit('METER')
    setUnitPrice('0')
    setAdvanceAmount('0')
    setWidthCm('')
    setColorCount('')
    setNotes('')
    setStatus('DRAFT')
    setFormError('')
  }

  useEffect(() => {
    if (!canWrite) return
    try {
      if (sessionStorage.getItem(OPEN_CREATE_FLAG) === '1') {
        sessionStorage.removeItem(OPEN_CREATE_FLAG)
        resetForm()
        setFormOpen(true)
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only openCreate flag
  }, [canWrite])

  const reloadSelectedAndList = async (id: number) => {
    await load()
    const row = await apiGet<SalesOrder>(`/orders/${id}`)
    setSelected(row)
    setSelectedId(id)
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (liveRemaining < 0) {
      setFormError('Kalan tutar negatif olamaz.')
      return
    }
    if (status === 'DRAFT' && Number(advanceAmount) > 0) {
      setFormError('Avanslı sipariş için durumu Onaylı seçin.')
      return
    }
    setSaving(true)
    setError('')
    setFormError('')
    try {
      const created = await apiRequest<SalesOrder>('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: Number(customerId),
          productId: productId ? Number(productId) : undefined,
          orderDate,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          quantity: Number(quantity),
          unit,
          unitPrice: Number(unitPrice),
          advanceAmount: Number(advanceAmount) || 0,
          widthCm: widthCm ? Number(widthCm) : undefined,
          colorCount: colorCount ? Number(colorCount) : undefined,
          notes: notes.trim() || undefined,
          status,
        }),
      })
      setFormOpen(false)
      resetForm()
      await load()
      setSelectedId(created.id)
      setSuccessNotice('Yeni sipariş kaydedildi.')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Sipariş kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirmStatus = async () => {
    if (!selected || !canWrite) return
    setSaving(true)
    setError('')
    try {
      const updated = await apiRequest<SalesOrder>(
        `/orders/${selected.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'CONFIRMED' }),
        },
      )
      setSelected(updated)
      setConfirmConfirm(false)
      await load()
      setSuccessNotice('Sipariş onaylandı.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Durum güncellenemedi.')
    } finally {
      setSaving(false)
    }
  }

  const canOperate =
    canWrite &&
    selected != null &&
    selected.status !== 'DRAFT' &&
    selected.status !== 'CANCELLED'

  const handleDelivery = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !canOperate || saving) return
    setSaving(true)
    setError('')
    try {
      await apiPost(`/orders/${selected.id}/deliveries`, {
        deliveryDate,
        quantity: Number(deliveryQty),
        notes: deliveryNotes.trim() || undefined,
      })
      setDeliveryQty('')
      setDeliveryNotes('')
      setDeliveryDate(todayYmd())
      await reloadSelectedAndList(selected.id)
      setSuccessNotice('Teslimat kaydedildi.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Teslimat kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleCollection = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !canOperate || saving) return
    setSaving(true)
    setError('')
    try {
      await apiPost(`/orders/${selected.id}/collections`, {
        amount: Number(collectionAmount),
        transactionAt: toIsoDateTime(collectionAt),
        description: collectionDesc.trim() || undefined,
        postToCash: true,
      })
      setCollectionAmount('')
      setCollectionDesc('')
      setCollectionAt(nowDatetimeLocal())
      await reloadSelectedAndList(selected.id)
      setSuccessNotice('Tahsilat kaydedildi.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tahsilat kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleExtraAdvance = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !canOperate || saving) return
    setSaving(true)
    setError('')
    try {
      await apiPost(`/orders/${selected.id}/advance`, {
        amount: Number(extraAdvanceAmount),
        transactionAt: toIsoDateTime(extraAdvanceAt),
        description: extraAdvanceDesc.trim() || undefined,
        postToCash: true,
      })
      setExtraAdvanceAmount('')
      setExtraAdvanceDesc('')
      setExtraAdvanceAt(nowDatetimeLocal())
      await reloadSelectedAndList(selected.id)
      setSuccessNotice('Avans kaydedildi.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Avans kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
      <ModuleSummary
        items={[
          { label: 'Toplam Sipariş', value: String(summary.total) },
          { label: 'Üretimde', value: String(summary.inProduction) },
          { label: 'Onay Bekliyor', value: String(summary.draft) },
          {
            label: 'Bu Ay Tutar',
            value: formatMoney(summary.monthAmount).replace(' DZD', ''),
            unit: 'DZD',
          },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Siparişler</h2>
          {canWrite && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                resetForm()
                setFormOpen(true)
              }}
            >
              + Yeni Sipariş
            </button>
          )}
        </div>

        <ModuleToolbar
          reportType="orders"
          reportLabel="Sipariş Raporu"
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder="Sipariş no, müşteri veya durum ara…"
        />

        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="empty-state">Yükleniyor…</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Sipariş kaydı bulunamadı
            </p>
            <p style={{ marginBottom: 20 }}>
              İlk gerçek siparişinizi kaydedin. Demo sipariş üretilmez.
            </p>
            {canWrite && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  resetForm()
                  setFormOpen(true)
                }}
              >
                Yeni sipariş ekle
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Müşteri</th>
                  <th>Tarih</th>
                  <th>Durum</th>
                  <th>Tutar</th>
                  <th>Kalan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelected(null)
                      setSelectedId(order.id)
                    }}
                  >
                    <td>{order.orderNumber}</td>
                    <td>{order.customerName ?? '—'}</td>
                    <td>{order.orderDate.split('-').reverse().join('.')}</td>
                    <td>
                      <StatusBadge
                        status={STATUS_LABELS[order.status] ?? order.status}
                      />
                    </td>
                    <td>{formatMoney(order.grossTotal, order.currency)}</td>
                    <td>{formatMoney(order.remainingAmount, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <section className="panel panel--full" style={{ marginTop: 16 }}>
          <div className="panel__header">
            <h2>
              Sipariş detayı · {selected.orderNumber}
            </h2>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setSelectedId(null)}
            >
              Kapat
            </button>
          </div>
          <div className="demo-form" style={{ display: 'grid', gap: 8 }}>
            <p>
              <strong>Müşteri:</strong> {selected.customerName ?? selected.customerId}
            </p>
            <p><strong>Ürün:</strong> {selected.productName ?? 'Bağlı ürün yok'}</p>
            <p>
              <strong>Durum:</strong>{' '}
              {STATUS_LABELS[selected.status] ?? selected.status}
            </p>
            <p>
              <strong>Miktar:</strong> {selected.quantity} {selected.unit}
            </p>
            <p>
              <strong>Birim fiyat:</strong>{' '}
              {formatMoney(selected.unitPrice, selected.currency)}
            </p>
            <p>
              <strong>Toplam:</strong>{' '}
              {formatMoney(selected.grossTotal, selected.currency)}
            </p>
            <p>
              <strong>Avans:</strong>{' '}
              {formatMoney(selected.advanceAmount, selected.currency)}
            </p>
            <p>
              <strong>Tahsilat:</strong>{' '}
              {formatMoney(selected.collectedAmount, selected.currency)}
            </p>
            <p>
              <strong>Kalan:</strong>{' '}
              {formatMoney(selected.remainingAmount, selected.currency)}
            </p>
            <p>
              <strong>Teslim edilen:</strong> {selected.deliveredQuantity} /{' '}
              {selected.quantity}
            </p>
            {selected.notes && (
              <p>
                <strong>Not:</strong> {selected.notes}
              </p>
            )}
            {canWrite && selected.status === 'DRAFT' && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setConfirmConfirm(true)}
                  disabled={saving}
                >
                  Siparişi onayla
                </button>
              </div>
            )}

            {canOperate && (
              <div
                style={{
                  display: 'grid',
                  gap: 16,
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--color-border-light)',
                }}
              >
                <form
                  className="demo-form"
                  onSubmit={(e) => void handleDelivery(e)}
                  style={{ display: 'grid', gap: 8 }}
                >
                  <h3 style={{ margin: 0, fontSize: 15 }}>Teslimat ekle</h3>
                  <label>
                    Teslim tarihi
                    <input
                      type="date"
                      required
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </label>
                  <label>
                    Miktar
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      required
                      value={deliveryQty}
                      onChange={(e) => setDeliveryQty(e.target.value)}
                    />
                  </label>
                  <label>
                    Not
                    <input
                      type="text"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={saving || !deliveryQty}
                    >
                      {saving ? 'Kaydediliyor…' : 'Teslimat kaydet'}
                    </button>
                  </div>
                </form>

                <form
                  className="demo-form"
                  onSubmit={(e) => void handleCollection(e)}
                  style={{ display: 'grid', gap: 8 }}
                >
                  <h3 style={{ margin: 0, fontSize: 15 }}>Tahsilat</h3>
                  <label>
                    Tutar (DZD)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={collectionAmount}
                      onChange={(e) => setCollectionAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    İşlem zamanı
                    <input
                      type="datetime-local"
                      required
                      value={collectionAt}
                      onChange={(e) => setCollectionAt(e.target.value)}
                    />
                  </label>
                  <label>
                    Açıklama
                    <input
                      type="text"
                      value={collectionDesc}
                      onChange={(e) => setCollectionDesc(e.target.value)}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={saving || !collectionAmount}
                    >
                      {saving ? 'Kaydediliyor…' : 'Tahsilat kaydet'}
                    </button>
                  </div>
                </form>

                <form
                  className="demo-form"
                  onSubmit={(e) => void handleExtraAdvance(e)}
                  style={{ display: 'grid', gap: 8 }}
                >
                  <h3 style={{ margin: 0, fontSize: 15 }}>Avans</h3>
                  <label>
                    Tutar (DZD)
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      value={extraAdvanceAmount}
                      onChange={(e) => setExtraAdvanceAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    İşlem zamanı
                    <input
                      type="datetime-local"
                      required
                      value={extraAdvanceAt}
                      onChange={(e) => setExtraAdvanceAt(e.target.value)}
                    />
                  </label>
                  <label>
                    Açıklama
                    <input
                      type="text"
                      value={extraAdvanceDesc}
                      onChange={(e) => setExtraAdvanceDesc(e.target.value)}
                    />
                  </label>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn btn--ghost"
                      disabled={saving || !extraAdvanceAmount}
                    >
                      {saving ? 'Kaydediliyor…' : 'Avans kaydet'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {selected.deliveries.length > 0 && (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Teslimat</th>
                      <th>Miktar</th>
                      <th>Not</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.deliveries.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.deliveryDate
                            ? d.deliveryDate.split('-').reverse().join('.')
                            : '—'}
                        </td>
                        <td>{d.quantity}</td>
                        <td>{d.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <Modal
        open={formOpen}
        title="Yeni Sipariş"
        onClose={() => {
          setFormOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCreate(e)}>
          {formError && (
            <p className="demo-notice" role="alert" style={{ margin: '0 0 12px' }}>
              {formError}
            </p>
          )}
          <label>
            Müşteri
            <select
              required
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
          <label>
            Ürün
            <select value={productId} onChange={(e) => { const id=e.target.value; setProductId(id); const p=products.find(x=>x.id===Number(id)); if(p){setUnit(p.unit); if(p.salePrice!=null)setUnitPrice(String(p.salePrice))} }}>
              <option value="">Eski tip / ürünsüz sipariş</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </label>
          <label>
            Sipariş tarihi
            <input
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </label>
          <label>
            Planlanan teslim
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </label>
          <label>
            Miktar
            <input
              type="number"
              min="0.001"
              step="0.001"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            Birim
            <select
              value={unit}
              onChange={(e) =>
                setUnit(e.target.value as 'METER' | 'PIECE' | 'KILOGRAM')
              }
            >
              <option value="METER">Metre</option>
              <option value="PIECE">Adet</option>
              <option value="KILOGRAM">Kilogram</option>
            </select>
          </label>
          <label>
            Birim fiyat (DZD)
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </label>
          <label>
            Avans (DZD)
            <input
              type="number"
              min="0"
              step="0.01"
              value={advanceAmount}
              onChange={(e) => setAdvanceAmount(e.target.value)}
            />
          </label>
          <label>
            En (cm)
            <input
              type="number"
              min="0"
              step="0.01"
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
              value={colorCount}
              onChange={(e) => setColorCount(e.target.value)}
            />
          </label>
          <label>
            Notlar
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <label>
            Durum
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'CONFIRMED')}
            >
              <option value="DRAFT">Taslak</option>
              <option value="CONFIRMED">Onaylı</option>
            </select>
          </label>
          {status === 'CONFIRMED' && (
            <p className="demo-notice" role="status">
              Onaylı sipariş kaydedildiğinde müşteri cari hesabına satış borcu işlenir.
            </p>
          )}

          <div
            style={{
              padding: '12px 14px',
              borderRadius: 8,
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border-light)',
            }}
          >
            <p>
              <strong>Toplam:</strong> {formatMoney(liveGross)}
            </p>
            <p>
              <strong>Avans:</strong> {formatMoney(Number(advanceAmount) || 0)}
            </p>
            <p>
              <strong>Kalan:</strong>{' '}
              <span style={{ color: liveRemaining < 0 ? '#b42318' : undefined }}>
                {formatMoney(liveRemaining)}
              </span>
            </p>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setFormOpen(false)}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={
                saving ||
                liveRemaining < 0 ||
                !customerId ||
                (status === 'DRAFT' && Number(advanceAmount) > 0)
              }
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmConfirm}
        title="Siparişi onayla"
        message="Onay sonrası müşteri cari hesabına satış borcu işlenir. Devam edilsin mi?"
        confirmLabel="Onayla"
        onCancel={() => setConfirmConfirm(false)}
        onConfirm={() => void handleConfirmStatus()}
      />
    </>
  )
}

/** Günlük İşler → Yeni sipariş için create modalını açar. */
export function markOpenOrderCreate(): void {
  try {
    sessionStorage.setItem(OPEN_CREATE_FLAG, '1')
  } catch {
    // ignore
  }
}
