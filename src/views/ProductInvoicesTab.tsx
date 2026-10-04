import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiPatch, apiPost } from '../data/api'
import { algiersYmd } from '../data/dates'
import { useI18n } from '../i18n/I18nProvider'

type CustomerOption = { id: number; name: string }
type ProductOption = { id: number; code: string; name: string; salePrice: number | null }

type InvoiceItem = {
  id?: number
  productId: number | null
  modelName?: string | null; color?: string | null; widthCm?: number | null; sourceDescription?: string | null; quantity?: number; unit?: string; lineDescription?: string
  productCode?: string
  productNameSnapshot?: string
  quantityMeter: number
  unitPrice: number
  lineTotal?: number
}

type ProductInvoice = {
  id: number
  customerId: number
  customerName: string
  invoiceNumber: string
  invoiceDate: string
  status: 'DRAFT' | 'FINALIZED' | 'CANCELED'
  currency: string
  subtotal: number
  paidAmount: number
  remainingAmount: number
  notes: string | null
  items: InvoiceItem[]
}

type FormItem = {
  modelName:string; color:string; widthCm:string; sourceDescription:string; unit:string;
  productId: string
  quantityMeter: string
  unitPrice: string
}

const emptyItem = (): FormItem => ({ productId: '', quantityMeter: '1', unitPrice: '0', modelName:'',color:'',widthCm:'',sourceDescription:'',unit:'METER' })

export function ProductInvoicesTab({ canWrite = false }: { canWrite?: boolean }) {
  const { t, formatCurrency, formatDate, formatNumber } = useI18n()
  const [invoices, setInvoices] = useState<ProductInvoice[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [successNotice, setSuccessNotice] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ProductInvoice | null>(null)
  const [finalizeTarget, setFinalizeTarget] = useState<ProductInvoice | null>(null)
  const [cancelTarget, setCancelTarget] = useState<ProductInvoice | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [invoiceDate, setInvoiceDate] = useState(algiersYmd())
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<FormItem[]>([emptyItem()])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [invoiceRows, customerRows, productRows] = await Promise.all([
        apiGet<ProductInvoice[]>('/product-invoices'),
        apiGet<Array<{ id: number; name: string }>>('/customers').catch(() => []),
        apiGet<ProductOption[]>('/products').catch(() => []),
      ])
      setInvoices(invoiceRows)
      setCustomers(customerRows.map((c) => ({ id: c.id, name: c.name })))
      setProducts(productRows)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('invoices.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const resetForm = () => {
    setEditing(null)
    setCustomerId('')
    setInvoiceDate(algiersYmd())
    setNotes('')
    setItems([emptyItem()])
    setFormError('')
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (invoice: ProductInvoice) => {
    if (invoice.status !== 'DRAFT') return
    setEditing(invoice)
    setCustomerId(String(invoice.customerId))
    setInvoiceDate(invoice.invoiceDate.slice(0, 10))
    setNotes(invoice.notes ?? '')
    setItems(
      invoice.items.length > 0
        ? invoice.items.map((item) => ({
            productId: item.productId ? String(item.productId) : '',
            modelName:item.modelName||item.productNameSnapshot||'',color:item.color??'',widthCm:item.widthCm==null?'':String(item.widthCm),sourceDescription:item.sourceDescription??'',unit:item.unit??'METER',
            quantityMeter: String(item.quantity??item.quantityMeter),
            unitPrice: String(item.unitPrice),
          }))
        : [emptyItem()],
    )
    setFormError('')
    setFormOpen(true)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    const validItems = items.map(item=>({productId:item.productId?Number(item.productId):null,modelName:item.modelName.trim()||undefined,color:item.color.trim()||undefined,widthCm:item.widthCm?Number(item.widthCm):undefined,sourceDescription:item.sourceDescription||undefined,quantity:Number(item.quantityMeter),unit:item.unit,unitPrice:Number(item.unitPrice)}))
    if(!customerId||!validItems.length||validItems.some(item=>(!item.productId&&!item.modelName&&!item.sourceDescription)||!Number.isFinite(item.quantity)||item.quantity<=0||!Number.isFinite(item.unitPrice)||item.unitPrice<=0||!item.unit||(item.widthCm!==undefined&&(!Number.isFinite(item.widthCm)||item.widthCm<0)))){
      setFormError('Eksik veya geçersiz satırı tamamlayın. Hiçbir satır atılmadı.');return
    }
    setSaving(true)
    setFormError('')
    const payload = {
      customerId: Number(customerId),
      invoiceDate,
      notes: notes.trim() || undefined,
      items: validItems,
    }
    try {
      if (editing) {
        await apiPatch(`/product-invoices/${editing.id}`, payload)
        setSuccessNotice(t('invoices.updated'))
      } else {
        await apiPost('/product-invoices', payload)
        setSuccessNotice(t('invoices.saved'))
      }
      setFormOpen(false)
      resetForm()
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('invoices.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleFinalize = async () => {
    if (!finalizeTarget || !canWrite || saving) return
    setSaving(true)
    try {
      await apiPost(`/product-invoices/${finalizeTarget.id}/finalize`)
      setFinalizeTarget(null)
      setSuccessNotice(t('invoices.finalized'))
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('invoices.actionError'))
      setFinalizeTarget(null)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelTarget || !canWrite || saving) return
    setSaving(true)
    try {
      await apiPost(`/product-invoices/${cancelTarget.id}/cancel`)
      setCancelTarget(null)
      setSuccessNotice(t('invoices.cancelled'))
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('invoices.actionError'))
      setCancelTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('invoices.title')}</h2>
          {canWrite && (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              + {t('invoices.new')}
            </button>
          )}
        </div>
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('invoices.number')}</th>
                <th>{t('invoices.customer')}</th>
                <th>{t('invoices.date')}</th>
                <th>{t('invoices.status')}</th>
                <th>{t('invoices.subtotal')}</th>
                <th>{t('invoices.remaining')}</th>
                {canWrite && <th>{t('invoices.actions')}</th>}
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td><span className="mono">{invoice.invoiceNumber}</span>{invoice.items.map((item,i)=><p key={item.id??i}>{item.lineDescription||item.productNameSnapshot}{item.sourceDescription&&<small style={{display:'block'}}>{item.sourceDescription}</small>}</p>)}</td>
                  <td>{invoice.customerName}</td>
                  <td className="date-cell">{formatDate(`${invoice.invoiceDate}T12:00:00`)}</td>
                  <td>{t(`invoices.status.${invoice.status}`)}</td>
                  <td className="amount-cell">{formatCurrency(invoice.subtotal, invoice.currency)}</td>
                  <td className="amount-cell">{formatCurrency(invoice.remainingAmount, invoice.currency)}</td>
                  {canWrite && (
                    <td>
                      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                        {invoice.status === 'DRAFT' && (
                          <>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              disabled={saving}
                              onClick={() => openEdit(invoice)}
                            >
                              {t('invoices.edit')}
                            </button>
                            <button
                              type="button"
                              className="btn btn--primary"
                              disabled={saving}
                              onClick={() => setFinalizeTarget(invoice)}
                            >
                              {t('invoices.finalize')}
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost"
                              disabled={saving}
                              onClick={() => setCancelTarget(invoice)}
                            >
                              {t('invoices.cancel')}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 7 : 6} className="empty-cell">
                    {t('invoices.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={formOpen}
        title={editing ? t('invoices.editTitle') : t('invoices.newTitle')}
        onClose={() => {
          if (saving) return
          setFormOpen(false)
          resetForm()
        }}
        wide
      >
        <form className="demo-form" onSubmit={(e) => void handleSave(e)}>
          <label>
            {t('invoices.customer')}
            <select
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              disabled={Boolean(editing)}
            >
              <option value="">{t('invoices.select')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('invoices.date')}
            <input
              type="date"
              required
              dir="ltr"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </label>
          <label>
            {t('invoices.notes')}
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {items.map((item, index) => (
            <div key={index} className="form-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
              <select
                value={item.productId}
                onChange={(e) => {
                  const next = [...items]
                  const product = products.find((p) => String(p.id) === e.target.value)
                  next[index] = {
                    ...item,
                    productId: e.target.value,
                    modelName: item.modelName || product?.name || '',
                    unitPrice:
                      product?.salePrice != null ? String(product.salePrice) : item.unitPrice,
                  }
                  setItems(next)
                }}
              >
                <option value="">Ürün bağlantısı yok — serbest satır</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} · {product.name}
                  </option>
                ))}
              </select>
              {(['modelName','color','widthCm','sourceDescription'] as const).map(field=><label key={field}>{({modelName:'Model / serbest ürün adı',color:'Renk',widthCm:'Ölçü (cm)',sourceDescription:'Kaynak açıklama'})[field]}<input value={item[field]} onChange={e=>setItems(rows=>rows.map((r,i)=>i===index?{...r,[field]:e.target.value}:r))}/></label>)}
              <label>Satış birimi<select value={item.unit} onChange={e=>setItems(rows=>rows.map((r,i)=>i===index?{...r,unit:e.target.value}:r))}><option value="METER">Metre</option><option value="PIECE">Adet</option><option value="KILOGRAM">Kilogram</option></select></label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                required
                dir="ltr"
                value={item.quantityMeter}
                onChange={(e) => {
                  const next = [...items]
                  next[index] = { ...item, quantityMeter: e.target.value }
                  setItems(next)
                }}
                style={{ width: 110 }}
                title="Satış miktarı"
              />
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                dir="ltr"
                value={item.unitPrice}
                onChange={(e) => {
                  const next = [...items]
                  next[index] = { ...item, unitPrice: e.target.value }
                  setItems(next)
                }}
                style={{ width: 110 }}
                title={t('invoices.unitPrice')}
              />
              <span className="panel__meta" dir="ltr">
                {formatNumber(Number(item.quantityMeter || 0) * Number(item.unitPrice || 0), {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          ))}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setItems((prev) => [...prev, emptyItem()])}
            >
              + {t('invoices.addLine')}
            </button>
          </div>
          {formError && (
            <p className="demo-notice" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={saving}
              onClick={() => {
                setFormOpen(false)
                resetForm()
              }}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving
                ? t('invoices.saving')
                : editing
                  ? t('invoices.saveChanges')
                  : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(finalizeTarget)}
        title={t('invoices.finalizeTitle')}
        message={
          finalizeTarget
            ? t('invoices.finalizeConfirm', { number: finalizeTarget.invoiceNumber })
            : ''
        }
        confirmLabel={t('invoices.finalize')}
        onCancel={() => setFinalizeTarget(null)}
        onConfirm={() => void handleFinalize()}
      />
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t('invoices.cancelTitle')}
        message={
          cancelTarget
            ? t('invoices.cancelConfirm', { number: cancelTarget.invoiceNumber })
            : ''
        }
        confirmLabel={t('invoices.cancel')}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => void handleCancel()}
      />
    </>
  )
}
