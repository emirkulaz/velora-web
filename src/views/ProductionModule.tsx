import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { StatusBadge } from '../components/StatusBadge'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiPatch, apiPost } from '../data/api'
import { algiersYmd } from '../data/dates'

type ProductOption = {
  id: number
  code: string
  name: string
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
}

type ProductionOrder = {
  id: number
  orderNumber: string
  productId: number
  productCode: string | null
  productName: string | null
  plannedQuantity: number
  completedQuantity: number
  progress: number
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  dueDate: string | null
  notes: string | null
  delayed: boolean
}

const STATUS_LABELS: Record<ProductionOrder['status'], string> = {
  PLANNED: 'Planlandı',
  IN_PROGRESS: 'Üretimde',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

const OPEN_CREATE_FLAG = 'velora.production.openCreate'

function todayYmd() {
  return algiersYmd()
}

function unitLabel(unit: ProductionOrder['unit']) {
  if (unit === 'METER') return 'm'
  if (unit === 'PIECE') return 'adet'
  return 'kg'
}

export function markOpenProductionCreate(): void {
  sessionStorage.setItem(OPEN_CREATE_FLAG, '1')
}

export function ProductionModule({ canWrite = false }: { canWrite?: boolean }) {
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [successNotice, setSuccessNotice] = useState('')
  const [productId, setProductId] = useState('')
  const [plannedQuantity, setPlannedQuantity] = useState('1')
  const [unit, setUnit] = useState<'METER' | 'PIECE' | 'KILOGRAM'>('METER')
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [progressEdits, setProgressEdits] = useState<Record<number, string>>({})
  const [statusTarget, setStatusTarget] = useState<{
    order: ProductionOrder
    status: ProductionOrder['status']
  } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [orderRows, productRows] = await Promise.all([
        apiGet<ProductionOrder[]>('/production-orders'),
        apiGet<ProductOption[]>('/products').catch(() => [] as ProductOption[]),
      ])
      setOrders(orderRows)
      setProducts(productRows)
      setError('')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Üretim emirleri alınamadı.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!canWrite) return
    if (sessionStorage.getItem(OPEN_CREATE_FLAG) === '1') {
      sessionStorage.removeItem(OPEN_CREATE_FLAG)
      setFormOpen(true)
    }
  }, [canWrite])

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase('tr-TR')
    if (!q) return orders
    return orders.filter(
      (o) =>
        o.orderNumber.toLocaleLowerCase('tr-TR').includes(q) ||
        (o.productName ?? '').toLocaleLowerCase('tr-TR').includes(q) ||
        (o.productCode ?? '').toLocaleLowerCase('tr-TR').includes(q),
    )
  }, [orders, search])

  const summary = useMemo(() => {
    const active = orders.filter(
      (o) => o.status === 'PLANNED' || o.status === 'IN_PROGRESS',
    )
    const delayed = active.filter((o) => o.delayed).length
    const completed = orders.filter((o) => o.status === 'COMPLETED').length
    const avg =
      active.length === 0
        ? 0
        : active.reduce((sum, o) => sum + o.progress, 0) / active.length
    return {
      active: active.length,
      delayed,
      completed,
      avgProgress: Math.round(avg),
    }
  }, [orders])

  const resetForm = () => {
    setProductId('')
    setPlannedQuantity('1')
    setUnit('METER')
    setDueDate('')
    setNotes('')
    setFormError('')
  }

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    setSaving(true)
    setError('')
    setFormError('')
    try {
      await apiPost('/production-orders', {
        productId: Number(productId),
        plannedQuantity: Number(plannedQuantity),
        unit,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      })
      setFormOpen(false)
      resetForm()
      await load()
      setSuccessNotice('Yeni üretim emri kaydedildi.')
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Üretim emri kaydedilemedi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleProgressSave = async (order: ProductionOrder) => {
    if (!canWrite || saving) return
    const raw = progressEdits[order.id] ?? String(order.completedQuantity)
    const completedQuantity = Number(raw)
    if (!Number.isFinite(completedQuantity) || completedQuantity < 0) {
      setError('Geçerli bir tamamlanan miktar girin.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiPatch(`/production-orders/${order.id}`, { completedQuantity })
      await load()
      setSuccessNotice('Üretim ilerlemesi güncellendi.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'İlerleme güncellenemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleStatus = async (
    order: ProductionOrder,
    status: ProductionOrder['status'],
  ) => {
    if (!canWrite || saving) return
    setSaving(true)
    setError('')
    try {
      const body: { status: string; completedQuantity?: number } = { status }
      if (status === 'COMPLETED') {
        body.completedQuantity = order.plannedQuantity
      }
      await apiPatch(`/production-orders/${order.id}`, body)
      await load()
      setSuccessNotice('Üretim emri durumu güncellendi.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Durum güncellenemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
      <ModuleSummary
        items={[
          { label: 'Aktif Emir', value: loading ? '…' : String(summary.active) },
          { label: 'Geciken', value: loading ? '…' : String(summary.delayed) },
          { label: 'Tamamlanan', value: loading ? '…' : String(summary.completed) },
          {
            label: 'Ort. İlerleme',
            value: loading ? '…' : String(summary.avgProgress),
            unit: '%',
          },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Aktif Üretim Emirleri</h2>
          {canWrite && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                resetForm()
                setFormOpen(true)
              }}
            >
              + Üretim Emri
            </button>
          )}
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Emir no veya ürün ara..."
        />
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Emir No</th>
                <th>Ürün</th>
                <th>Planlanan</th>
                <th>Tamamlanan</th>
                <th>İlerleme</th>
                <th>Durum</th>
                <th>Termin</th>
                {canWrite && <th>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className={order.delayed ? 'row--delayed' : ''}>
                  <td className="mono">{order.orderNumber}</td>
                  <td>
                    <div>{order.productName ?? '—'}</div>
                    <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                      {order.productCode}
                    </div>
                  </td>
                  <td>
                    {order.plannedQuantity.toLocaleString('tr-TR')}{' '}
                    {unitLabel(order.unit)}
                  </td>
                  <td>
                    {canWrite &&
                    order.status !== 'COMPLETED' &&
                    order.status !== 'CANCELLED' ? (
                      <div className="form-actions" style={{ gap: 6 }}>
                        <input
                          type="number"
                          min={0}
                          step="0.001"
                          style={{ width: 96 }}
                          value={
                            progressEdits[order.id] ??
                            String(order.completedQuantity)
                          }
                          onChange={(e) =>
                            setProgressEdits((prev) => ({
                              ...prev,
                              [order.id]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={saving}
                          onClick={() => void handleProgressSave(order)}
                        >
                          Kaydet
                        </button>
                      </div>
                    ) : (
                      <>
                        {order.completedQuantity.toLocaleString('tr-TR')}{' '}
                        {unitLabel(order.unit)}
                      </>
                    )}
                  </td>
                  <td>
                    <div className="table-progress">
                      <div className="progress-bar">
                        <div
                          className="progress-bar__fill"
                          style={{ width: `${order.progress}%` }}
                        />
                      </div>
                      <span>{order.progress}%</span>
                    </div>
                  </td>
                  <td>
                    <StatusBadge
                      status={
                        order.delayed
                          ? 'Gecikmiş'
                          : STATUS_LABELS[order.status]
                      }
                    />
                  </td>
                  <td className="date-cell">
                    {order.dueDate
                      ? order.dueDate.split('-').reverse().join('.')
                      : '—'}
                  </td>
                  {canWrite && (
                    <td>
                      <div className="form-actions" style={{ gap: 6 }}>
                        {order.status === 'PLANNED' && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() =>
                              void handleStatus(order, 'IN_PROGRESS')
                            }
                          >
                            Başlat
                          </button>
                        )}
                        {(order.status === 'PLANNED' ||
                          order.status === 'IN_PROGRESS') && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() =>
                              setStatusTarget({ order, status: 'COMPLETED' })
                            }
                          >
                            Tamamla
                          </button>
                        )}
                        {(order.status === 'PLANNED' ||
                          order.status === 'IN_PROGRESS') && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() =>
                              setStatusTarget({ order, status: 'CANCELLED' })
                            }
                          >
                            İptal
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="empty-cell">
                    Henüz üretim emri yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={formOpen}
        title="Yeni Üretim Emri"
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
            Ürün
            <select
              required
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = products.find((x) => String(x.id) === e.target.value)
                if (p) setUnit(p.unit)
              }}
            >
              <option value="">Seçin</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Planlanan miktar
            <input
              type="number"
              min="0.001"
              step="0.001"
              required
              value={plannedQuantity}
              onChange={(e) => setPlannedQuantity(e.target.value)}
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
            Termin
            <input
              type="date"
              min={todayYmd()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            Not
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
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
              disabled={saving || !productId}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={statusTarget != null}
        title={
          statusTarget?.status === 'COMPLETED'
            ? 'Üretim emrini tamamla'
            : 'Üretim emrini iptal et'
        }
        message={
          statusTarget?.status === 'COMPLETED'
            ? 'Planlanan miktar tamamlanmış olarak kaydedilecek. Devam edilsin mi?'
            : 'İptal edilmiş üretim emri yeniden açılamaz. Devam edilsin mi?'
        }
        confirmLabel={statusTarget?.status === 'COMPLETED' ? 'Tamamla' : 'İptal et'}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => {
          if (statusTarget) {
            void handleStatus(statusTarget.order, statusTarget.status)
          }
          setStatusTarget(null)
        }}
      />
    </>
  )
}
