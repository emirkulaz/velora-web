import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { StatusBadge } from '../components/StatusBadge'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../data/api'
import type { CompanyPresentation } from '../data/companyBranding'
import { algiersYmd } from '../data/dates'
import { useI18n } from '../i18n/I18nProvider'
import { BomRecipesTab } from './BomRecipesTab'

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
  stockWarnings?: string[]
  materials?: Array<{
    materialProductId: number
    materialName: string
    plannedQuantity: number
    actualQuantity: number | null
    theoreticalWaste: number
    actualWaste: number | null
    unit: string
    available: number
    shortage: number
    sufficient: boolean
    variance: number | null
    plannedCost: number | null
    actualCost: number | null
    status: string
  }>
  plannedMaterialCost?: number | null
  actualMaterialCost?: number | null
  missingCost?: boolean
  extraCost?: {
    laborCost: number
    accessoryCost: number
    packagingCost: number
    otherCost: number
    electricityCost: number
  } | null
}

const OPEN_CREATE_FLAG = 'velora.production.openCreate'

function todayYmd() {
  return algiersYmd()
}

export function ProductionModule({
  company = null,
  canWrite = false,
}: {
  company?: CompanyPresentation | null
  canWrite?: boolean
}) {
  const { locale, t, formatCurrency, formatDate, formatNumber } = useI18n()
  const unitText = (value: string) => {
    const key = `requests.unit.${value}`
    const translated = t(key)
    return translated === key ? value : translated
  }
  const [search, setSearch] = useState('')
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductionOrder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductionOrder | null>(null)
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
  const [tab, setTab] = useState<'orders' | 'boms'>('orders')
  const [detail, setDetail] = useState<ProductionOrder | null>(null)
  const [actuals, setActuals] = useState<Record<number, string>>({})
  const [wastes, setWastes] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
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
          : t('production.loadError'),
      )
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  useEffect(() => {
    if (!canWrite) return
    if (sessionStorage.getItem(OPEN_CREATE_FLAG) === '1') {
      sessionStorage.removeItem(OPEN_CREATE_FLAG)
      const timeoutId = window.setTimeout(() => setFormOpen(true), 0)
      return () => window.clearTimeout(timeoutId)
    }
  }, [canWrite])

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase(locale)
    if (!q) return orders
    return orders.filter(
      (o) =>
        o.orderNumber.toLocaleLowerCase(locale).includes(q) ||
        (o.productName ?? '').toLocaleLowerCase(locale).includes(q) ||
        (o.productCode ?? '').toLocaleLowerCase(locale).includes(q),
    )
  }, [locale, orders, search])

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
    setEditing(null)
    setProductId('')
    setPlannedQuantity('1')
    setUnit('METER')
    setDueDate('')
    setNotes('')
    setFormError('')
  }

  const openEdit = (order: ProductionOrder) => {
    setEditing(order)
    setProductId(String(order.productId))
    setPlannedQuantity(String(order.plannedQuantity))
    setUnit(order.unit)
    setDueDate(order.dueDate ?? '')
    setNotes(order.notes ?? '')
    setFormError('')
    setFormOpen(true)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    setSaving(true)
    setError('')
    setFormError('')
    try {
      if (editing) {
        await apiPatch(`/production-orders/${editing.id}`, {
          plannedQuantity: Number(plannedQuantity),
          dueDate: dueDate || null,
          notes: notes.trim() || null,
        })
        setFormOpen(false)
        resetForm()
        await load()
        setSuccessNotice(t('production.updated'))
        return
      }
      const created = await apiPost<ProductionOrder>('/production-orders', {
        productId: Number(productId),
        plannedQuantity: Number(plannedQuantity),
        unit,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      })
      setFormOpen(false)
      resetForm()
      await load()
      const warning = created.stockWarnings?.length
        ? ` ${t('production.stockWarning', { warning: created.stockWarnings.join(' · ') })}`
        : ''
      setSuccessNotice(`${t('production.created')}${warning}`)
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t('production.saveError'),
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
      setError(t('production.invalidCompleted'))
      return
    }
    setSaving(true)
    setError('')
    try {
      await apiPatch(`/production-orders/${order.id}`, { completedQuantity })
      await load()
      setSuccessNotice(t('production.progressUpdated'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('production.progressError'))
    } finally {
      setSaving(false)
    }
  }

  const openDetail = async (order: ProductionOrder) => {
    try {
      const full = await apiGet<ProductionOrder>(`/production-orders/${order.id}`)
      setDetail(full)
      const nextActuals: Record<number, string> = {}
      const nextWastes: Record<number, string> = {}
      for (const line of full.materials ?? []) {
        nextActuals[line.materialProductId] = String(line.actualQuantity ?? line.plannedQuantity)
        nextWastes[line.materialProductId] = String(line.actualWaste ?? '')
      }
      setActuals(nextActuals)
      setWastes(nextWastes)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('production.detailError'))
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
      if (status === 'COMPLETED') {
        await apiPost(`/production-orders/${order.id}/complete`, {
          completedQuantity: order.plannedQuantity,
          consumptions: (detail?.id === order.id ? detail.materials : order.materials)?.map((line) => ({
            materialProductId: line.materialProductId,
            actualQuantity: Number(actuals[line.materialProductId] ?? line.plannedQuantity),
            wasteQuantity: wastes[line.materialProductId]
              ? Number(wastes[line.materialProductId])
              : undefined,
          })),
        })
      } else {
        await apiPatch(`/production-orders/${order.id}`, { status })
      }
      await load()
      if (detail?.id === order.id) await openDetail(order)
      setSuccessNotice(t('production.statusUpdated'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('production.statusError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canWrite || saving) return
    setSaving(true)
    setError('')
    try {
      await apiDelete(`/production-orders/${deleteTarget.id}`)
      if (detail?.id === deleteTarget.id) setDetail(null)
      setDeleteTarget(null)
      await load()
      setSuccessNotice(t('production.deleted'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('production.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
      <div className="module-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={tab === 'orders' ? 'module-tab module-tab--active' : 'module-tab'}
          onClick={() => setTab('orders')}
        >
          {t('production.ordersTab')}
        </button>
        <button
          type="button"
          className={tab === 'boms' ? 'module-tab module-tab--active' : 'module-tab'}
          onClick={() => setTab('boms')}
        >
          {t('production.recipesTab')}
        </button>
      </div>
      {tab === 'boms' && <BomRecipesTab company={company} canWrite={canWrite} />}
      {tab === 'orders' && (
      <>
      <ModuleSummary
        items={[
          { label: t('production.activeOrders'), value: loading ? '…' : formatNumber(summary.active) },
          { label: t('production.delayed'), value: loading ? '…' : formatNumber(summary.delayed) },
          { label: t('production.completed'), value: loading ? '…' : formatNumber(summary.completed) },
          {
            label: t('production.averageProgress'),
            value: loading ? '…' : formatNumber(summary.avgProgress),
            unit: '%',
          },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('production.title')}</h2>
          {canWrite && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                resetForm()
                setFormOpen(true)
              }}
            >
              + {t('production.new')}
            </button>
          )}
        </div>
        <ModuleToolbar
          reportType="production"
          reportLabel={t('production.report')}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('production.search')}
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
                <th>{t('production.orderNumber')}</th>
                <th>{t('production.product')}</th>
                <th>{t('production.planned')}</th>
                <th>{t('production.completedQuantity')}</th>
                <th>{t('production.progress')}</th>
                <th>{t('production.status')}</th>
                <th>{t('production.dueDate')}</th>
                {canWrite && <th>{t('production.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id} className={order.delayed ? 'row--delayed' : ''}>
                  <td className="mono">
                    <button type="button" className="btn btn--ghost" onClick={() => void openDetail(order)}>
                      {order.orderNumber}
                    </button>
                  </td>
                  <td>
                    <div>{order.productName ?? '—'}</div>
                    <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                      {order.productCode}
                    </div>
                  </td>
                  <td>
                    {formatNumber(order.plannedQuantity)}{' '}
                    {t(`requests.unit.${order.unit}`)}
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
                          {t('common.save')}
                        </button>
                      </div>
                    ) : (
                      <>
                        {formatNumber(order.completedQuantity)}{' '}
                        {t(`requests.unit.${order.unit}`)}
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
                          ? t('production.status.DELAYED')
                          : t(`production.status.${order.status}`)
                      }
                    />
                  </td>
                  <td className="date-cell">
                    {order.dueDate
                      ? formatDate(`${order.dueDate}T12:00:00`)
                      : '—'}
                  </td>
                  {canWrite && (
                    <td>
                      <div className="form-actions" style={{ gap: 6 }}>
                        {(order.status === 'PLANNED' ||
                          order.status === 'IN_PROGRESS') && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() => openEdit(order)}
                          >
                            {t('production.edit')}
                          </button>
                        )}
                        {order.status === 'PLANNED' &&
                          order.completedQuantity === 0 && (
                            <button
                              type="button"
                              className="btn btn--ghost"
                              disabled={saving}
                              onClick={() => setDeleteTarget(order)}
                            >
                              {t('production.delete')}
                            </button>
                          )}
                        {order.status === 'PLANNED' && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() =>
                              void handleStatus(order, 'IN_PROGRESS')
                            }
                          >
                            {t('production.start')}
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
                            {t('production.finish')}
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
                            {t('production.cancel')}
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
                    {t('production.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={formOpen}
        title={editing ? t('production.editTitle') : t('production.newTitle')}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleSave(e)}>
          {formError && (
            <p className="demo-notice" role="alert" style={{ margin: '0 0 12px' }}>
              {formError}
            </p>
          )}
          <label>
            {t('production.product')}
            <select
              required
              disabled={editing != null}
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                const p = products.find((x) => String(x.id) === e.target.value)
                if (p) setUnit(p.unit)
              }}
            >
              <option value="">{t('production.select')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('production.plannedQuantity')}
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
            {t('production.unit')}
            <select
              value={unit}
              disabled={editing != null}
              onChange={(e) =>
                setUnit(e.target.value as 'METER' | 'PIECE' | 'KILOGRAM')
              }
            >
              <option value="METER">{t('requests.unit.METER')}</option>
              <option value="PIECE">{t('requests.unit.PIECE')}</option>
              <option value="KILOGRAM">{t('requests.unit.KILOGRAM')}</option>
            </select>
          </label>
          <label>
            {t('production.dueDate')}
            <input
              type="date"
              min={todayYmd()}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            {t('production.note')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || !productId}
            >
              {saving ? t('production.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={statusTarget != null}
        title={
          statusTarget?.status === 'COMPLETED'
            ? t('production.finishTitle')
            : t('production.cancelTitle')
        }
        message={
          statusTarget?.status === 'COMPLETED'
            ? t('production.finishMessage')
            : t('production.cancelMessage')
        }
        confirmLabel={statusTarget?.status === 'COMPLETED' ? t('production.finish') : t('production.cancelAction')}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => {
          if (statusTarget) {
            void handleStatus(statusTarget.order, statusTarget.status)
          }
          setStatusTarget(null)
        }}
      />
      <ConfirmDialog
        open={deleteTarget != null}
        title={t('production.deleteTitle')}
        message={
          deleteTarget
            ? t('production.deleteConfirm', { number: deleteTarget.orderNumber })
            : ''
        }
        confirmLabel={t('production.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />

      <Modal
        open={detail != null}
        title={detail ? t('production.detailTitle', { number: detail.orderNumber }) : t('production.detail')}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div>
            {(detail.materials ?? []).length === 0 ? (
              <p className="demo-notice">{t('production.noSnapshot')}</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('production.material')}</th>
                      <th>{t('production.required')}</th>
                      <th>{t('production.inStock')}</th>
                      <th>{t('production.shortage')}</th>
                      <th>{t('production.actual')}</th>
                      <th>{t('production.status')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.materials?.map((line) => (
                      <tr key={line.materialProductId}>
                        <td>{line.materialName}</td>
                        <td>
                          {formatNumber(line.plannedQuantity)} {unitText(line.unit)}
                        </td>
                        <td>
                          {formatNumber(line.available)} {unitText(line.unit)}
                        </td>
                        <td>
                          {formatNumber(line.shortage)} {unitText(line.unit)}
                        </td>
                        <td>
                          {detail.status === 'COMPLETED' ? (
                            <>
                              {formatNumber(line.actualQuantity ?? 0)} {unitText(line.unit)}
                              {line.variance != null && (
                                <div className="panel__meta">
                                  {t('production.variance', { value: `${line.variance > 0 ? '+' : ''}${formatNumber(line.variance)} ${unitText(line.unit)}` })}
                                </div>
                              )}
                            </>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              step="0.001"
                              style={{ width: 96 }}
                              value={actuals[line.materialProductId] ?? String(line.plannedQuantity)}
                              onChange={(e) =>
                                setActuals((prev) => ({
                                  ...prev,
                                  [line.materialProductId]: e.target.value,
                                }))
                              }
                            />
                          )}
                        </td>
                        <td>{line.sufficient ? t('production.materialSufficient') : t('production.materialInsufficient')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="panel__meta" style={{ marginTop: 12 }}>
              {t('production.plannedMaterialCost')}:{' '}
              {detail.missingCost || detail.plannedMaterialCost == null
                ? t('production.missingCost')
                : formatCurrency(detail.plannedMaterialCost)}
              {detail.actualMaterialCost != null &&
                ` · ${t('production.actualCost', { value: formatCurrency(detail.actualMaterialCost) })}`}
            </p>
            {detail.extraCost && (
              <p className="panel__meta">
                {t('production.extraCosts', {
                  labor: formatCurrency(detail.extraCost.laborCost),
                  accessory: formatCurrency(detail.extraCost.accessoryCost),
                  packaging: formatCurrency(detail.extraCost.packagingCost),
                  electricity: formatCurrency(detail.extraCost.electricityCost),
                  other: formatCurrency(detail.extraCost.otherCost),
                })}
              </p>
            )}
            {canWrite && detail.status !== 'COMPLETED' && detail.status !== 'CANCELLED' && (
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving}
                  onClick={() => setStatusTarget({ order: detail, status: 'COMPLETED' })}
                >
                  {t('production.finishWithActuals')}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
      </>
      )}
    </>
  )
}
