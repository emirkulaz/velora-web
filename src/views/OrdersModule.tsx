import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { StatusBadge } from '../components/StatusBadge'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiRequest } from '../data/api'
import { algiersDatetimeLocal, algiersYmd } from '../data/dates'
import { useI18n } from '../i18n/I18nProvider'
import { OPEN_ORDER_CREATE_FLAG } from './orderActions'
import { ProductInvoicesTab } from './ProductInvoicesTab'

type CustomerOption = { id: number; name: string }
type ProductOption = { id:number; code:string; name:string; unit:'METER'|'PIECE'|'KILOGRAM'; salePrice:number|null }

type SalesOrder = {
  id: number
  customerId: number
  customerName: string | null
  productId: number | null
  modelName?: string | null; color?: string | null; sourceDescription?: string | null; lineDescription?: string
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

function canEditOrder(status: string) {
  return status !== 'CANCELLED'
}

function canDeleteOrder(status: string) {
  return status === 'DRAFT'
}

function canCancelOrder(status: string) {
  return (
    status === 'DRAFT' ||
    status === 'CONFIRMED' ||
    status === 'IN_PRODUCTION' ||
    status === 'READY'
  )
}

export function OrdersModule({ canWrite = false }: { canWrite?: boolean }) {
  const { locale, t, formatCurrency, formatDate, formatNumber } = useI18n()
  const [moduleTab, setModuleTab] = useState<'orders' | 'invoices'>('orders')
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SalesOrder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SalesOrder | null>(null)
  const [cancelTarget, setCancelTarget] = useState<SalesOrder | null>(null)
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
  const [modelName,setModelName]=useState('')
  const [color,setColor]=useState('')
  const [sourceDescription,setSourceDescription]=useState('')
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
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{ id: number; name: string; currency: string; isActive: boolean }>>([])
  const [collectionAccountId, setCollectionAccountId] = useState('')
  const [advanceAccountId, setAdvanceAccountId] = useState('')
  const [initialAccountId, setInitialAccountId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const paymentAccountField = (value: string, onChange: (id: string) => void) => <><label>{t('reserve.receiptAccount')}<select required value={value} onChange={e => onChange(e.target.value)}><option value="">{t('reserve.text10')}</option>{paymentAccounts.filter(a=>a.isActive && a.currency === (selected?.currency ?? 'DZD')).map(a=><option key={a.id} value={a.id}>{a.name} · {a.currency}</option>)}</select></label><label>{t('reserve.paymentMethod')}<select value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option value="CASH">{t('reserve.cashMethod')}</option><option value="BANK">{t('reserve.bankMethod')}</option></select></label></>

  const liveGross = useMemo(() => {
    const q = Number(quantity) || 0
    const p = Number(unitPrice) || 0
    return Math.round(q * p * 100) / 100
  }, [quantity, unitPrice])

  const liveRemaining = useMemo(() => {
    const paid = editing
      ? editing.advanceAmount + editing.collectedAmount
      : Number(advanceAmount) || 0
    return Math.round((liveGross - paid) * 100) / 100
  }, [liveGross, advanceAmount, editing])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [orderRows, customerRows, productRows, accountRows] = await Promise.all([
        apiGet<SalesOrder[]>('/orders'),
        apiGet<Array<{ id: number; name: string }>>('/customers'),
        apiGet<ProductOption[]>('/products'),
        apiGet<typeof paymentAccounts>('/cash-accounts').catch(() => []),
      ])
      setOrders(orderRows)
      setCustomers(customerRows.map((c) => ({ id: c.id, name: c.name })))
      setProducts(productRows)
      setPaymentAccounts(Array.isArray(accountRows) ? accountRows : [])
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('orders.loadError'),
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
    try {
      const value = sessionStorage.getItem('velora.orders.selectedId')
      if (value && /^\d+$/.test(value)) {
        const timer = window.setTimeout(() => { sessionStorage.removeItem('velora.orders.selectedId'); setSelectedId(Number(value)) }, 0)
        return () => window.clearTimeout(timer)
      }
    } catch { /* Storage is optional. */ }
  }, [])

  useEffect(() => {
    if (selectedId == null) return
    let cancelled = false
    ;(async () => {
      try {
        const row = await apiGet<SalesOrder>(`/orders/${selectedId}`)
        if (!cancelled) setSelected(row)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError ? err.message : t('orders.detailError'),
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId, t])

  const filtered = orders.filter((order) => {
    const q = query.trim().toLocaleLowerCase(locale)
    if (!q) return true
    return (
      order.orderNumber.toLocaleLowerCase(locale).includes(q) ||
      (order.customerName ?? '').toLocaleLowerCase(locale).includes(q) ||
      t(`orders.status.${order.status}`).toLocaleLowerCase(locale).includes(q)
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
    setEditing(null)
    setCustomerId('')
    setProductId('')
    setOrderDate(todayYmd())
    setExpectedDeliveryDate('')
    setQuantity('1')
    setUnit('METER')
    setUnitPrice('0')
    setAdvanceAmount('0')
    setInitialAccountId('')
    setWidthCm('')
    setColorCount('')
    setModelName('');setColor('');setSourceDescription('')
    setNotes('')
    setStatus('DRAFT')
    setFormError('')
  }

  useEffect(() => {
    if (!canWrite) return
    let shouldOpen = false
    try {
      if (sessionStorage.getItem(OPEN_ORDER_CREATE_FLAG) === '1') {
        shouldOpen = true
      }
    } catch {
      // ignore
    }
    if (!shouldOpen) return
    const timeoutId = window.setTimeout(() => {
      try { sessionStorage.removeItem(OPEN_ORDER_CREATE_FLAG) } catch { /* optional */ }
      resetForm()
      setFormOpen(true)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [canWrite])

  const fillForm = (order: SalesOrder) => {
    setCustomerId(String(order.customerId))
    setProductId(order.productId ? String(order.productId) : '')
    setOrderDate(order.orderDate)
    setExpectedDeliveryDate(order.expectedDeliveryDate ?? '')
    setQuantity(String(order.quantity))
    setUnit(order.unit)
    setUnitPrice(String(order.unitPrice))
    setAdvanceAmount(String(order.advanceAmount))
    setWidthCm(order.widthCm != null ? String(order.widthCm) : '')
    setColorCount(order.colorCount != null ? String(order.colorCount) : '')
    setModelName(order.modelName??'');setColor(order.color??'');setSourceDescription(order.sourceDescription??'')
    setNotes(order.notes ?? '')
    setStatus(order.status === 'CONFIRMED' ? 'CONFIRMED' : 'DRAFT')
    setFormError('')
  }

  const openEdit = (order: SalesOrder) => {
    setEditing(order)
    fillForm(order)
    setFormOpen(true)
  }

  const reloadSelectedAndList = async (id: number) => {
    await load()
    const row = await apiGet<SalesOrder>(`/orders/${id}`)
    setSelected(row)
    setSelectedId(id)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!editing && Number(advanceAmount) > 0 && !initialAccountId) { setFormError(t('reserve.chooseReceiptAccount')); return }
    if (liveRemaining < 0) {
      setFormError(t('orders.negativeRemaining'))
      return
    }
    if (!editing && status === 'DRAFT' && Number(advanceAmount) > 0) {
      setFormError(t('orders.advanceRequiresConfirmation'))
      return
    }
    setSaving(true)
    setError('')
    setFormError('')
    try {
      if (editing) {
        const updated = await apiPatch<SalesOrder>(`/orders/${editing.id}`, {
          customerId: Number(customerId),
          modelName:modelName.trim(),color:color.trim(),sourceDescription:sourceDescription.trim(),
          productId: productId ? Number(productId) : null,
          orderDate,
          expectedDeliveryDate: expectedDeliveryDate || null,
          quantity: Number(quantity),
          unit,
          unitPrice: Number(unitPrice),
          widthCm: widthCm ? Number(widthCm) : null,
          colorCount: colorCount ? Number(colorCount) : null,
          notes: notes.trim() || null,
        })
        setFormOpen(false)
        resetForm()
        await load()
        setSelectedId(updated.id)
        setSelected(updated)
        setSuccessNotice(t('orders.updated'))
        return
      }
      const created = await apiRequest<SalesOrder>('/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: Number(customerId),
          modelName:modelName.trim(),color:color.trim(),sourceDescription:sourceDescription.trim(),
          productId: productId ? Number(productId) : undefined,
          orderDate,
          expectedDeliveryDate: expectedDeliveryDate || undefined,
          quantity: Number(quantity),
          unit,
          unitPrice: Number(unitPrice),
          advanceAmount: Number(advanceAmount) || 0,
          cashAccountId: initialAccountId ? Number(initialAccountId) : undefined,
          paymentMethod,
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
      setSuccessNotice(t('orders.created'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('orders.saveError'))
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
      setSuccessNotice(t('orders.confirmed'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('orders.statusError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canWrite || saving) return
    setSaving(true)
    setError('')
    try {
      await apiDelete(`/orders/${deleteTarget.id}`)
      if (selectedId === deleteTarget.id) {
        setSelected(null)
        setSelectedId(null)
      }
      setDeleteTarget(null)
      await load()
      setSuccessNotice(t('orders.deleted'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('orders.deleteError'))
    } finally {
      setSaving(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancelTarget || !canWrite || saving) return
    setSaving(true)
    setError('')
    try {
      const updated = await apiPatch<SalesOrder>(
        `/orders/${cancelTarget.id}/status`,
        { status: 'CANCELLED' },
      )
      setCancelTarget(null)
      setSelected(updated)
      setSelectedId(updated.id)
      await load()
      setSuccessNotice(t('orders.cancelled'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('orders.statusError'))
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
      setSuccessNotice(t('orders.deliverySaved'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('orders.deliveryError'))
    } finally {
      setSaving(false)
    }
  }

  const handleCollection = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !canOperate || saving) return
    if (!collectionAccountId) { setError(t('reserve.chooseReceiptAccount')); return }
    setSaving(true)
    setError('')
    try {
      await apiPost(`/orders/${selected.id}/collections`, {
        amount: Number(collectionAmount),
        transactionAt: toIsoDateTime(collectionAt),
        description: collectionDesc.trim() || undefined,
        postToCash: true,
        cashAccountId: Number(collectionAccountId),
        paymentMethod,
      })
      setCollectionAmount('')
      setCollectionDesc('')
      setCollectionAt(nowDatetimeLocal())
      await reloadSelectedAndList(selected.id)
      setSuccessNotice(t('orders.collectionSaved'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('orders.collectionError'))
    } finally {
      setSaving(false)
    }
  }

  const handleExtraAdvance = async (event: FormEvent) => {
    event.preventDefault()
    if (!selected || !canOperate || saving) return
    if (!advanceAccountId) { setError(t('reserve.chooseReceiptAccount')); return }
    setSaving(true)
    setError('')
    try {
      await apiPost(`/orders/${selected.id}/advance`, {
        amount: Number(extraAdvanceAmount),
        transactionAt: toIsoDateTime(extraAdvanceAt),
        description: extraAdvanceDesc.trim() || undefined,
        postToCash: true,
        cashAccountId: Number(advanceAccountId),
        paymentMethod,
      })
      setExtraAdvanceAmount('')
      setExtraAdvanceDesc('')
      setExtraAdvanceAt(nowDatetimeLocal())
      await reloadSelectedAndList(selected.id)
      setSuccessNotice(t('orders.advanceSaved'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('orders.advanceError'))
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
          className={moduleTab === 'orders' ? 'module-tab module-tab--active' : 'module-tab'}
          onClick={() => setModuleTab('orders')}
        >
          {t('orders.tab.orders')}
        </button>
        <button
          type="button"
          className={moduleTab === 'invoices' ? 'module-tab module-tab--active' : 'module-tab'}
          onClick={() => setModuleTab('invoices')}
        >
          {t('orders.tab.invoices')}
        </button>
      </div>

      {moduleTab === 'invoices' ? (
        <ProductInvoicesTab canWrite={canWrite} />
      ) : (
      <>
      <ModuleSummary
        items={[
          { label: t('orders.totalOrders'), value: formatNumber(summary.total) },
          { label: t('orders.status.IN_PRODUCTION'), value: formatNumber(summary.inProduction) },
          { label: t('orders.pendingApproval'), value: formatNumber(summary.draft) },
          {
            label: t('orders.monthAmount'),
            value: formatNumber(summary.monthAmount, { maximumFractionDigits: 2 }),
            unit: 'DZD',
          },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('orders.title')}</h2>
          {canWrite && (
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                resetForm()
                setFormOpen(true)
              }}
            >
              + {t('orders.new')}
            </button>
          )}
        </div>

        <ModuleToolbar
          reportType="orders"
          reportLabel={t('orders.report')}
          search={query}
          onSearchChange={setQuery}
          searchPlaceholder={t('orders.search')}
        />

        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p className="empty-state">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              {t('orders.empty')}
            </p>
            <p style={{ marginBottom: 20 }}>
              {t('orders.emptyHint')}
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
                {t('orders.add')}
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('orders.order')}</th>
                  <th>{t('orders.customer')}</th>
                  <th>{t('orders.date')}</th>
                  <th>{t('orders.status')}</th>
                  <th>{t('orders.amount')}</th>
                  <th>{t('orders.remaining')}</th>
                  {canWrite && <th>{t('orders.actions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    style={{ cursor: 'pointer' }}
                    tabIndex={0}
                    aria-label={order.orderNumber}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(null); setSelectedId(order.id) } }}
                    onClick={() => {
                      setSelected(null)
                      setSelectedId(order.id)
                    }}
                  >
                    <td>{order.orderNumber}</td>
                    <td>{order.customerName ?? '—'}</td>
                    <td>{formatDate(`${order.orderDate}T12:00:00`)}</td>
                    <td>
                      <StatusBadge
                        status={t(`orders.status.${order.status}`)}
                      />
                    </td>
                    <td>{formatCurrency(order.grossTotal, order.currency)}</td>
                    <td>{formatCurrency(order.remainingAmount, order.currency)}</td>
                    {canWrite && (
                      <td onClick={(event) => event.stopPropagation()}>
                        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                          {canEditOrder(order.status) && (
                            <button
                              type="button"
                              className="btn btn--ghost"
                              onClick={() => openEdit(order)}
                            >
                              {t('orders.edit')}
                            </button>
                          )}
                          {canDeleteOrder(order.status) && (
                            <button
                              type="button"
                              className="btn btn--ghost"
                              onClick={() => setDeleteTarget(order)}
                            >
                              {t('orders.delete')}
                            </button>
                          )}
                          {order.status !== 'DRAFT' && canCancelOrder(order.status) && (
                            <button
                              type="button"
                              className="btn btn--ghost"
                              onClick={() => setCancelTarget(order)}
                            >
                              {t('orders.cancelOrder')}
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
              {t('orders.detail', { number: selected.orderNumber })}
            </h2>
            <div className="form-actions">
              {canWrite && canEditOrder(selected.status) && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => openEdit(selected)}
                >
                  {t('orders.edit')}
                </button>
              )}
              {canWrite && canDeleteOrder(selected.status) && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setDeleteTarget(selected)}
                >
                  {t('orders.delete')}
                </button>
              )}
              {canWrite &&
                selected.status !== 'DRAFT' &&
                canCancelOrder(selected.status) && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() => setCancelTarget(selected)}
                  >
                    {t('orders.cancelOrder')}
                  </button>
                )}
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setSelected(null)
                  setSelectedId(null)
                }}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
          <div className="demo-form" style={{ display: 'grid', gap: 8 }}>
            <p>
              <strong>{t('orders.customer')}:</strong> {selected.customerName ?? selected.customerId}
            </p>
            <p><strong>{t('orders.product')}:</strong> {selected.lineDescription || selected.productName || t('orders.noLinkedProduct')}</p>
            <p>
              <strong>{t('orders.status')}:</strong>{' '}
              {t(`orders.status.${selected.status}`)}
            </p>
            <p>
              <strong>{t('orders.quantity')}:</strong> {formatNumber(selected.quantity)} {t(`requests.unit.${selected.unit}`)}
            </p>
            <p>
              <strong>{t('orders.unitPrice')}:</strong>{' '}
              {formatCurrency(selected.unitPrice, selected.currency)}
            </p>
            <p>
              <strong>{t('orders.total')}:</strong>{' '}
              {formatCurrency(selected.grossTotal, selected.currency)}
            </p>
            <p>
              <strong>{t('orders.advance')}:</strong>{' '}
              {formatCurrency(selected.advanceAmount, selected.currency)}
            </p>
            <p>
              <strong>{t('orders.collection')}:</strong>{' '}
              {formatCurrency(selected.collectedAmount, selected.currency)}
            </p>
            <p>
              <strong>{t('orders.remaining')}:</strong>{' '}
              {formatCurrency(selected.remainingAmount, selected.currency)}
            </p>
            <p>
              <strong>{t('orders.delivered')}:</strong> {formatNumber(selected.deliveredQuantity)} /{' '}
              {formatNumber(selected.quantity)}
            </p>
            {selected.sourceDescription && <p>Kaynak: {selected.sourceDescription}</p>}
            {selected.notes && (
              <p>
                <strong>{t('orders.note')}:</strong> {selected.notes}
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
                  {t('orders.confirm')}
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
                  <h3 style={{ margin: 0, fontSize: 15 }}>{t('orders.addDelivery')}</h3>
                  <label>
                    {t('orders.deliveryDate')}
                    <input
                      type="date"
                      required
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </label>
                  <label>
                    {t('orders.quantity')}
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
                    {t('orders.note')}
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
                      {saving ? t('orders.saving') : t('orders.saveDelivery')}
                    </button>
                  </div>
                </form>

                <form
                  className="demo-form"
                  onSubmit={(e) => void handleCollection(e)}
                  style={{ display: 'grid', gap: 8 }}
                >
                  <h3 style={{ margin: 0, fontSize: 15 }}>{t('orders.collection')}</h3>
                  {paymentAccountField(collectionAccountId, setCollectionAccountId)}
                  <label>
                    {t('orders.amount')} (DZD)
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
                    {t('orders.transactionTime')}
                    <input
                      type="datetime-local"
                      required
                      value={collectionAt}
                      onChange={(e) => setCollectionAt(e.target.value)}
                    />
                  </label>
                  <label>
                    {t('orders.description')}
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
                      {saving ? t('orders.saving') : t('orders.saveCollection')}
                    </button>
                  </div>
                </form>

                <form
                  className="demo-form"
                  onSubmit={(e) => void handleExtraAdvance(e)}
                  style={{ display: 'grid', gap: 8 }}
                >
                  <h3 style={{ margin: 0, fontSize: 15 }}>{t('orders.advance')}</h3>
                  {paymentAccountField(advanceAccountId, setAdvanceAccountId)}
                  <label>
                    {t('orders.amount')} (DZD)
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
                    {t('orders.transactionTime')}
                    <input
                      type="datetime-local"
                      required
                      value={extraAdvanceAt}
                      onChange={(e) => setExtraAdvanceAt(e.target.value)}
                    />
                  </label>
                  <label>
                    {t('orders.description')}
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
                      {saving ? t('orders.saving') : t('orders.saveAdvance')}
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
                      <th>{t('orders.delivery')}</th>
                      <th>{t('orders.quantity')}</th>
                      <th>{t('orders.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.deliveries.map((d) => (
                      <tr key={d.id}>
                        <td>
                          {d.deliveryDate
                            ? formatDate(`${d.deliveryDate}T12:00:00`)
                            : '—'}
                        </td>
                        <td>{formatNumber(d.quantity)}</td>
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
        title={editing ? t('orders.editTitle') : t('orders.newTitle')}
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
            {t('orders.customer')}
            <select
              required
              disabled={
                editing != null &&
                (editing.advanceAmount > 0 || editing.collectedAmount > 0)
              }
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">{t('orders.select')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('orders.product')}
            <select
              disabled={Boolean(editing && editing.deliveredQuantity > 0)}
              value={productId}
              onChange={(e) => { const id=e.target.value; setProductId(id); const p=products.find(x=>x.id===Number(id)); if(p){setUnit(p.unit); if(p.salePrice!=null)setUnitPrice(String(p.salePrice))} }}
            >
              <option value="">Ürün bağlantısı yok — serbest sipariş</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
            </select>
          </label>
          <label>
            {t('orders.orderDate')}
            <input
              type="date"
              required
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
            />
          </label>
          <label>
            {t('orders.expectedDelivery')}
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
            />
          </label>
          <label>
            {t('orders.quantity')} ({t(`requests.unit.${unit}`)})
            <input
              type="number"
              min={editing?.deliveredQuantity ? String(editing.deliveredQuantity) : '0.001'}
              step={unit === 'PIECE' ? '1' : '0.001'}
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            {t('orders.unit')}
            <select
              value={unit}
              disabled={Boolean(productId || (editing && editing.deliveredQuantity > 0))}
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
            {t('work.priceUnit', { unit: t(`requests.unit.${unit}`) })}
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </label>
          {!editing && (
            <label>
              {t('orders.advanceDzd')}
              <input
                type="number"
                min="0"
                step="0.01"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
              />
            </label>
          )}
          {!editing && Number(advanceAmount) > 0 && paymentAccountField(initialAccountId, setInitialAccountId)}
          <details><summary>{t('work.optional')}</summary>
          <label>
            {t('orders.width')}
            <input
              type="number"
              min="0"
              step="0.01"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
          </label>
          <label>
            {t('orders.colorCount')}
            <input
              type="number"
              min="0"
              step="1"
              value={colorCount}
              onChange={(e) => setColorCount(e.target.value)}
            />
          </label>
          <label>
            {t('orders.notes')}
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          </details>
          {!editing && (
            <label>
              {t('orders.status')}
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'CONFIRMED')}
              >
                <option value="DRAFT">{t('orders.status.DRAFT')}</option>
                <option value="CONFIRMED">{t('orders.status.CONFIRMED')}</option>
              </select>
            </label>
          )}
          {!editing && status === 'CONFIRMED' && (
            <p className="demo-notice" role="status">
              {t('orders.confirmedLedgerNotice')}
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
              <strong>{t('orders.total')}:</strong> {formatCurrency(liveGross)}
            </p>
            <p>
              <strong>{t('orders.advance')}:</strong>{' '}
              {formatCurrency(
                editing
                  ? editing.advanceAmount + editing.collectedAmount
                  : Number(advanceAmount) || 0,
              )}
            </p>
            <p>
              <strong>{t('orders.remaining')}:</strong>{' '}
              <span style={{ color: liveRemaining < 0 ? '#b42318' : undefined }}>
                {formatCurrency(liveRemaining)}
              </span>
            </p>
          </div>

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
              disabled={
                saving ||
                liveRemaining < 0 ||
                !customerId ||
                (!editing && status === 'DRAFT' && Number(advanceAmount) > 0)
              }
            >
              {saving ? t('orders.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmConfirm}
        title={t('orders.confirmTitle')}
        message={t('orders.confirmMessage')}
        confirmLabel={t('common.confirm')}
        onCancel={() => setConfirmConfirm(false)}
        onConfirm={() => void handleConfirmStatus()}
      />
      <ConfirmDialog
        open={deleteTarget != null}
        title={t('orders.deleteTitle')}
        message={
          deleteTarget
            ? t('orders.deleteConfirm', { number: deleteTarget.orderNumber })
            : ''
        }
        confirmLabel={t('orders.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
      <ConfirmDialog
        open={cancelTarget != null}
        title={t('orders.cancelTitle')}
        message={
          cancelTarget
            ? t('orders.cancelMessage', { number: cancelTarget.orderNumber })
            : ''
        }
        confirmLabel={t('orders.cancelOrder')}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void handleCancelOrder()}
      />
      </>
      )}
    </>
  )
}

