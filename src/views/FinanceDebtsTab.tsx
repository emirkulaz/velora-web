import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { ApiError, apiGet, apiPost } from '../data/api'
import { algiersYmd } from '../data/dates'
import { useI18n } from '../i18n/I18nProvider'

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

const FILTERS: Array<'ALL' | DebtStatus> = ['ALL', 'OPEN', 'PARTIALLY_PAID', 'DUE_SOON', 'OVERDUE', 'PAID']

export function FinanceDebtsTab({ canWrite = false }: { canWrite?: boolean }) {
  const { t, formatCurrency, formatDate } = useI18n()
  const money = useCallback((value: number, currency = 'DZD') =>
    formatCurrency(value, currency), [formatCurrency])
  const debtDate = useCallback((value: string | null) =>
    value ? formatDate(value.length === 10 ? `${value}T12:00:00` : value) : '—', [formatDate])
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

  const load = useCallback(async () => {
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
      setError(err instanceof ApiError ? err.message : t('debt.loadError'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [dueFrom, dueTo, maxRemaining, minRemaining, query, status, t])

  const openDetail = useCallback(async (row: DebtItem) => {
    try {
      const data = await apiGet<DebtDetail>(`/supplier-debts/${row.supplierId}`)
      setDetail(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('debt.detailError'))
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

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
    const timer = window.setTimeout(() => {
      if (row) {
        void openDetail(row)
        return
      }
      apiGet<DebtDetail>(`/supplier-debts/${supplierId}`)
        .then(setDetail)
        .catch(() => undefined)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loading, items, openDetail])

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

  const openPay = (row: DebtItem) => {
    setPaySupplier(row)
    setPayAmount(row.remaining > 0 ? String(row.remaining) : '')
    setPayDate(algiersYmd())
    setPayDescription(t('debt.paymentDescription', { name: row.supplierName }))
    setPayAccountId('')
    setFormError('')
    setPayOpen(true)
  }

  const handlePay = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || !paySupplier || saving) return
    const amount = Number(payAmount)
    if (!Number.isFinite(amount) || amount < 0.01) {
      setFormError(t('debt.invalidAmount'))
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
      setFormError(err instanceof ApiError ? err.message : t('debt.paymentError'))
    } finally {
      setSaving(false)
    }
  }

  const kpiCards = useMemo(
    () =>
      kpis
        ? [
            { label: t('debt.totalOpen'), value: money(kpis.totalOpenDebt, currency) },
            { label: t('debt.dueWeek'), value: money(kpis.dueThisWeek, currency) },
            { label: t('debt.overdueKpi'), value: money(kpis.overdue, currency) },
            { label: t('debt.paidMonth'), value: money(kpis.paidThisMonth, currency) },
          ]
        : [],
    [currency, kpis, money, t],
  )

  return (
    <>
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('debt.title')}</h2>
          <span className="panel__meta">
            {t('debt.subtitle')}
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
              key={filter}
              type="button"
              className={
                status === filter ? 'module-tab module-tab--active' : 'module-tab'
              }
              onClick={() => setStatus(filter)}
            >
              {filter === 'ALL' ? t('debt.filter.ALL') : t(`debt.status.${filter}`)}
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
            {t('debt.supplier')}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('debt.searchName')}
            />
          </label>
          <label>
            {t('debt.dueFrom')}
            <input
              type="date"
              dir="ltr"
              value={dueFrom}
              onChange={(event) => setDueFrom(event.target.value)}
            />
          </label>
          <label>
            {t('debt.dueTo')}
            <input
              type="date"
              dir="ltr"
              value={dueTo}
              onChange={(event) => setDueTo(event.target.value)}
            />
          </label>
          <label>
            {t('debt.minRemaining')}
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
            {t('debt.maxRemaining')}
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
              {t('debt.filter')}
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
                <th>{t('debt.creditorSupplier')}</th>
                <th>{t('debt.type')}</th>
                <th>{t('debt.total')}</th>
                <th>{t('debt.paid')}</th>
                <th>{t('debt.remaining')}</th>
                <th>{t('debt.due')}</th>
                <th>{t('debt.status')}</th>
                <th>{t('debt.lastTransaction')}</th>
                {canWrite && <th>{t('debt.action')}</th>}
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
                  <td className="date-cell">{debtDate(row.dueDate)}</td>
                  <td>{t(`debt.status.${row.status}`)}</td>
                  <td className="date-cell">{debtDate(row.lastMovementAt)}</td>
                  {canWrite && (
                    <td>
                      {row.remaining > 0 && (
                        <button
                          type="button"
                          className="btn btn--primary"
                          onClick={() => openPay(row)}
                        >
                          {t('debt.pay')}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 9 : 8} className="empty-cell">
                    {t('debt.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(detail)}
        title={detail ? detail.supplierName : t('debt.detail')}
        onClose={() => setDetail(null)}
        wide
      >
        {detail && (
          <div>
            <p>
              {t('debt.totalPurchases')}: <strong>{money(detail.totalDebt, detail.currency)}</strong>
            </p>
            <p>
              {t('debt.paid')}: <strong>{money(detail.paid, detail.currency)}</strong>
            </p>
            <p>
              {t('debt.remaining')}: <strong>{money(detail.remaining, detail.currency)}</strong>
            </p>
            <p>
              {t('debt.status')}: <strong>{t(`debt.status.${detail.status}`)}</strong>
              {detail.dueDate ? ` · ${t('debt.dueValue', { date: debtDate(detail.dueDate) })}` : ''}
            </p>
            {canWrite && detail.remaining > 0 && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => openPay(detail)}
                >
                  {t('debt.pay')}
                </button>
              </div>
            )}
            <h4>{t('debt.movements')}</h4>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('debt.date')}</th>
                    <th>{t('debt.transaction')}</th>
                    <th>{t('debt.document')}</th>
                    <th>{t('debt.debit')}</th>
                    <th>{t('debt.payment')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.movements.map((row) => (
                    <tr key={row.id}>
                      <td>{debtDate(row.date)}</td>
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
                        {t('debt.noMovements')}
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
        title={paySupplier ? t('debt.paymentTitle', { name: paySupplier.supplierName }) : t('debt.payment')}
        onClose={() => {
          setPayOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(event) => void handlePay(event)}>
          <label>
            {t('debt.amount', { currency: paySupplier?.currency ?? 'DZD' })}
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
            {t('debt.date')}
            <input
              type="date"
              required
              dir="ltr"
              value={payDate}
              onChange={(event) => setPayDate(event.target.value)}
            />
          </label>
          <label>
            {t('debt.description')}
            <input
              dir="ltr"
              value={payDescription}
              onChange={(event) => setPayDescription(event.target.value)}
            />
          </label>
          <label>
            {t('debt.cashAccount')}
            <select
              dir="ltr"
              value={payAccountId}
              onChange={(event) => setPayAccountId(event.target.value)}
            >
              <option value="">{t('debt.defaultAccount')}</option>
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
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t('debt.saving') : t('debt.submitPayment')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
