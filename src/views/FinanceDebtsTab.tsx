import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { ApiError, apiGet, apiPost } from '../data/api'
import { algiersYmd } from '../data/dates'

type DebtStatus = 'OPEN' | 'PARTIALLY_PAID' | 'PAID' | 'DUE_SOON' | 'OVERDUE'

type DebtKpis = {
  totalOpenDebt: number
  dueThisWeek: number
  overdue: number
  paidThisMonth: number
}

type DebtItem = {
  supplierId: number
  supplierName: string
  currency: string
  debtType: string
  totalDebt: number
  paid: number
  remaining: number
  dueDate: string | null
  status: DebtStatus
  lastMovementAt: string | null
}

type DebtDetail = DebtItem & {
  contactName: string | null
  phone: string | null
  paymentTerms: string | null
  movements: Array<{
    id: number
    date: string
    type: string
    label: string
    debit: number
    credit: number
    amount: number
    description: string
    documentNumber: string | null
    purchaseOrderId: number | null
    orderNo: string | null
    goodsReceiptId: number | null
    cashTransactionId: number | null
  }>
}

type CashAccount = { id: number; code: string; name: string }

const STATUS_LABEL: Record<DebtStatus, string> = {
  OPEN: 'Açık',
  PARTIALLY_PAID: 'Kısmi ödenmiş',
  PAID: 'Ödenmiş',
  DUE_SOON: 'Vadesi yaklaşıyor',
  OVERDUE: 'Vadesi geçmiş',
}

const FILTERS: Array<{ id: 'ALL' | DebtStatus; label: string }> = [
  { id: 'ALL', label: 'Tümü' },
  { id: 'OPEN', label: 'Açık' },
  { id: 'PARTIALLY_PAID', label: 'Kısmi ödenmiş' },
  { id: 'DUE_SOON', label: 'Vadesi yaklaşan' },
  { id: 'OVERDUE', label: 'Vadesi geçmiş' },
  { id: 'PAID', label: 'Ödenmiş' },
]

function money(value: number, currency = 'DZD') {
  return `${value.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(`${value}T12:00:00`).toLocaleDateString('tr-TR', {
    timeZone: 'Africa/Algiers',
  })
}

export function FinanceDebtsTab({ canWrite = false }: { canWrite?: boolean }) {
  const [status, setStatus] = useState<'ALL' | DebtStatus>('ALL')
  const [query, setQuery] = useState('')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [minRemaining, setMinRemaining] = useState('')
  const [maxRemaining, setMaxRemaining] = useState('')
  const [kpis, setKpis] = useState<DebtKpis | null>(null)
  const [items, setItems] = useState<DebtItem[]>([])
  const [currency, setCurrency] = useState('DZD')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<DebtDetail | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [paySupplier, setPaySupplier] = useState<DebtItem | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(algiersYmd())
  const [payDescription, setPayDescription] = useState('')
  const [payAccountId, setPayAccountId] = useState('')
  const [accounts, setAccounts] = useState<CashAccount[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'ALL') params.set('status', status)
      if (query.trim()) params.set('q', query.trim())
      if (dueFrom) params.set('dueFrom', dueFrom)
      if (dueTo) params.set('dueTo', dueTo)
      if (minRemaining) params.set('minRemaining', minRemaining)
      if (maxRemaining) params.set('maxRemaining', maxRemaining)
      const qs = params.toString()
      const snapshot = await apiGet<{
        currency: string
        kpis: DebtKpis
        items: DebtItem[]
      }>(`/supplier-debts${qs ? `?${qs}` : ''}`)
      setCurrency(snapshot.currency)
      setKpis(snapshot.kpis)
      setItems(snapshot.items)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Tedarikçi borçları alınamadı.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [status])

  useEffect(() => {
    if (loading) return
    let supplierId = 0
    try {
      const raw = sessionStorage.getItem('velora.finance.debtSupplierId')
      if (!raw) return
      sessionStorage.removeItem('velora.finance.debtSupplierId')
      supplierId = Number(raw)
    } catch {
      return
    }
    if (!Number.isFinite(supplierId) || supplierId <= 0) return
    const row = items.find((item) => item.supplierId === supplierId)
    if (row) {
      void openDetail(row)
      return
    }
    apiGet<DebtDetail>(`/supplier-debts/${supplierId}`)
      .then(setDetail)
      .catch(() => undefined)
  }, [loading, items])

  useEffect(() => {
    apiGet<{ accounts?: CashAccount[] } | CashAccount[]>('/cash/summary')
      .then((payload) => {
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.accounts)
            ? payload.accounts
            : []
        setAccounts(rows.map((row) => ({ id: row.id, code: row.code, name: row.name })))
      })
      .catch(() => setAccounts([]))
  }, [])

  const openDetail = async (row: DebtItem) => {
    try {
      const data = await apiGet<DebtDetail>(`/supplier-debts/${row.supplierId}`)
      setDetail(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Borç detayı alınamadı.')
    }
  }

  const openPay = (row: DebtItem) => {
    setPaySupplier(row)
    setPayAmount(row.remaining > 0 ? String(row.remaining) : '')
    setPayDate(algiersYmd())
    setPayDescription(`Tedarikçi ödemesi · ${row.supplierName}`)
    setPayAccountId('')
    setFormError('')
    setPayOpen(true)
  }

  const handlePay = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || !paySupplier || saving) return
    const amount = Number(payAmount)
    if (!Number.isFinite(amount) || amount < 0.01) {
      setFormError('Geçerli bir tutar girin.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await apiPost(`/suppliers/${paySupplier.supplierId}/payments`, {
        amount,
        transactionAt: payDate,
        description: payDescription.trim() || undefined,
        cashAccountId: payAccountId ? Number(payAccountId) : undefined,
      })
      setPayOpen(false)
      setPaySupplier(null)
      if (detail?.supplierId === paySupplier.supplierId) {
        const refreshed = await apiGet<DebtDetail>(
          `/supplier-debts/${paySupplier.supplierId}`,
        )
        setDetail(refreshed)
      }
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Ödeme kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const kpiCards = useMemo(
    () =>
      kpis
        ? [
            { label: 'Toplam Açık Borç', value: money(kpis.totalOpenDebt, currency) },
            { label: 'Bu Hafta Ödenecek', value: money(kpis.dueThisWeek, currency) },
            { label: 'Vadesi Geçmiş', value: money(kpis.overdue, currency) },
            { label: 'Bu Ay Ödenen', value: money(kpis.paidThisMonth, currency) },
          ]
        : [],
    [kpis, currency],
  )

  return (
    <>
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Borçlarım</h2>
          <span className="panel__meta">
            Şirketin tedarikçilere borcu · müşteri alacağı değil
          </span>
        </div>
        <div className="executive-kpis" style={{ padding: '12px 16px 0' }}>
          {kpiCards.map((card) => (
            <article className="executive-kpi executive-kpi--payable" key={card.label}>
              <span>{card.label}</span>
              <strong>{loading ? '…' : card.value}</strong>
              <small>SupplierLedger</small>
            </article>
          ))}
        </div>
        <div className="module-tabs" style={{ margin: '16px 16px 0' }}>
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={
                status === filter.id ? 'module-tab module-tab--active' : 'module-tab'
              }
              onClick={() => setStatus(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <form
          className="demo-form"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 10,
            padding: 16,
          }}
          onSubmit={(event) => {
            event.preventDefault()
            void load()
          }}
        >
          <label>
            Tedarikçi
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="İsim ara"
            />
          </label>
          <label>
            Vade başlangıç
            <input
              type="date"
              dir="ltr"
              value={dueFrom}
              onChange={(event) => setDueFrom(event.target.value)}
            />
          </label>
          <label>
            Vade bitiş
            <input
              type="date"
              dir="ltr"
              value={dueTo}
              onChange={(event) => setDueTo(event.target.value)}
            />
          </label>
          <label>
            Min kalan
            <input
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={minRemaining}
              onChange={(event) => setMinRemaining(event.target.value)}
            />
          </label>
          <label>
            Max kalan
            <input
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={maxRemaining}
              onChange={(event) => setMaxRemaining(event.target.value)}
            />
          </label>
          <div className="form-actions" style={{ alignSelf: 'end' }}>
            <button type="submit" className="btn btn--primary">
              Filtrele
            </button>
          </div>
        </form>
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Alacaklı / Tedarikçi</th>
                <th>Borç Türü</th>
                <th>Toplam Borç</th>
                <th>Ödenen</th>
                <th>Kalan</th>
                <th>Vade</th>
                <th>Durum</th>
                <th>Son İşlem</th>
                {canWrite && <th>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.supplierId}>
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void openDetail(row)}
                    >
                      {row.supplierName}
                    </button>
                  </td>
                  <td>{row.debtType}</td>
                  <td className="amount-cell">{money(row.totalDebt, row.currency)}</td>
                  <td className="amount-cell">{money(row.paid, row.currency)}</td>
                  <td className="amount-cell">{money(row.remaining, row.currency)}</td>
                  <td className="date-cell">{formatDate(row.dueDate)}</td>
                  <td>{STATUS_LABEL[row.status]}</td>
                  <td className="date-cell">{formatDate(row.lastMovementAt)}</td>
                  {canWrite && (
                    <td>
                      {row.remaining > 0 && (
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => openPay(row)}
                        >
                          Ödeme Yap
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 9 : 8} className="empty-cell">
                    Kayıtlı tedarikçi borcu yok. Borç yalnızca mal kabul onayında oluşur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(detail)}
        title={detail ? detail.supplierName : 'Borç detayı'}
        onClose={() => setDetail(null)}
        wide
      >
        {detail && (
          <div>
            <p>
              Toplam alış: <strong>{money(detail.totalDebt, detail.currency)}</strong>
            </p>
            <p>
              Ödenen: <strong>{money(detail.paid, detail.currency)}</strong>
            </p>
            <p>
              Kalan: <strong>{money(detail.remaining, detail.currency)}</strong>
            </p>
            <p>
              Durum: <strong>{STATUS_LABEL[detail.status]}</strong>
              {detail.dueDate ? ` · vade ${formatDate(detail.dueDate)}` : ''}
            </p>
            {canWrite && detail.remaining > 0 && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => openPay(detail)}
                >
                  Ödeme Yap
                </button>
              </div>
            )}
            <h4>Hareketler</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>İşlem</th>
                    <th>Belge</th>
                    <th>Borç</th>
                    <th>Ödeme</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.movements.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.label}</td>
                      <td>
                        {row.orderNo
                          ? `PO ${row.orderNo}${row.goodsReceiptId ? ` · GR #${row.goodsReceiptId}` : ''}`
                          : row.documentNumber ?? '—'}
                      </td>
                      <td className="amount-cell">
                        {row.credit > 0 ? money(row.credit, detail.currency) : '—'}
                      </td>
                      <td className="amount-cell">
                        {row.debit > 0 ? money(row.debit, detail.currency) : '—'}
                      </td>
                    </tr>
                  ))}
                  {detail.movements.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        Hareket yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={payOpen}
        title={paySupplier ? `Ödeme · ${paySupplier.supplierName}` : 'Ödeme'}
        onClose={() => {
          setPayOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(event) => void handlePay(event)}>
          <label>
            Tutar ({paySupplier?.currency ?? 'DZD'})
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              dir="ltr"
              value={payAmount}
              onChange={(event) => setPayAmount(event.target.value)}
            />
          </label>
          <label>
            Tarih
            <input
              type="date"
              required
              dir="ltr"
              value={payDate}
              onChange={(event) => setPayDate(event.target.value)}
            />
          </label>
          <label>
            Açıklama
            <input
              dir="ltr"
              value={payDescription}
              onChange={(event) => setPayDescription(event.target.value)}
            />
          </label>
          <label>
            Kasa hesabı
            <select
              dir="ltr"
              value={payAccountId}
              onChange={(event) => setPayAccountId(event.target.value)}
            >
              <option value="">Varsayılan (ANA-KASA)</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} — {account.name}
                </option>
              ))}
            </select>
          </label>
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
                setPayOpen(false)
                setFormError('')
              }}
            >
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Öde'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
