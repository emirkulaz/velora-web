import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiPost } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'
import { FinanceDebtsTab } from './FinanceDebtsTab'
import { CashFlowTab } from './CashFlowTab'

type Amount = number | string

interface CashTransaction {
  id: number
  transactionAt: string
  description: string
  debit: Amount
  credit: Amount
  balance: Amount | null
  reversesId: number | null
  cashAccount: {
    code: string
    name: string
    currency: string
  }
}

interface CashAccountSummary {
  id: number
  code: string
  name: string
  currency: string
  balance: Amount
}

interface LedgerCustomerSummary {
  customerId: number
  customerName: string
  currency: string
  totalSales: number
  totalPayments: number
  totalReturns: number
  balance: number
  transactionCount: number
  lastMovementAt: string | null
  reviewRequired: boolean
  source: string | null
}

interface LedgerSummaryResponse {
  currency: string
  customers: LedgerCustomerSummary[]
  totalReceivable: number
  totalAdvance: number
  meaning?: { positive: string; negative: string }
}

type CustomerOption = { id: number; name: string }
type CashType = 'CASH_IN' | 'CASH_OUT'

const OPEN_CASH_FLAG = 'velora.finance.openCash'
const OPEN_COLLECTION_FLAG = 'velora.finance.openCollection'
const FINANCE_TAB_FLAG = 'velora.finance.tab'

type FinanceTab = 'cash' | 'cashflow' | 'receivables' | 'debts' | 'expenses' | 'ledger'

function amount(value: Amount | null | undefined) {
  return Number(value ?? 0)
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

function normalizeAccounts(payload: unknown): CashAccountSummary[] {
  if (Array.isArray(payload)) return payload as CashAccountSummary[]
  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { accounts?: unknown }).accounts)
  ) {
    return (payload as { accounts: CashAccountSummary[] }).accounts
  }
  return []
}

export function FinanceModule({ canWrite = false }: { canWrite?: boolean }) {
  const { locale, t, formatDate, formatNumber } = useI18n()
  const formatAmount = useCallback(
    (value: Amount | null | undefined) =>
      formatNumber(amount(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    [formatNumber],
  )
  const [tab, setTab] = useState<FinanceTab>('cash')
  const [search, setSearch] = useState('')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [accounts, setAccounts] = useState<CashAccountSummary[]>([])
  const [ledgerCustomers, setLedgerCustomers] = useState<LedgerCustomerSummary[]>([])
  const [customers, setCustomers] = useState<CustomerOption[]>([])
  const [error, setError] = useState('')
  const [cashFormError, setCashFormError] = useState('')
  const [collectionFormError, setCollectionFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cashOpen, setCashOpen] = useState(false)
  const [collectionOpen, setCollectionOpen] = useState(false)
  const [successNotice, setSuccessNotice] = useState('')
  const [reverseTarget, setReverseTarget] = useState<CashTransaction | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reverseError, setReverseError] = useState('')

  const [cashType, setCashType] = useState<CashType>('CASH_IN')
  const [cashAmount, setCashAmount] = useState('')
  const [cashTransactionAt, setCashTransactionAt] = useState(todayYmd())
  const [cashCategory, setCashCategory] = useState('')
  const [cashDescription, setCashDescription] = useState('')
  const [cashCustomerId, setCashCustomerId] = useState('')
  const [cashAccountId, setCashAccountId] = useState('')

  const [collectionCustomerId, setCollectionCustomerId] = useState('')
  const [collectionAmount, setCollectionAmount] = useState('')
  const [collectionTransactionAt, setCollectionTransactionAt] = useState(todayYmd())
  const [collectionDescription, setCollectionDescription] = useState('')
  const [collectionAccountId, setCollectionAccountId] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cashTransactions, cashSummary, ledgerSummary, customerRows] = await Promise.all([
        apiGet<CashTransaction[]>('/cash/transactions'),
        apiGet<unknown>('/cash/summary'),
        apiGet<LedgerSummaryResponse>('/customer-ledger/summary').catch(() => null),
        apiGet<Array<{ id: number; name: string }>>('/customers').catch(() => []),
      ])
      setTransactions(Array.isArray(cashTransactions) ? cashTransactions : [])
      setAccounts(normalizeAccounts(cashSummary))
      setLedgerCustomers(ledgerSummary?.customers ?? [])
      setCustomers(customerRows.map((c) => ({ id: c.id, name: c.name })))
      setError('')
    } catch {
      setError(t('finance.loadError'))
      setTransactions([])
      setAccounts([])
      setLedgerCustomers([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(FINANCE_TAB_FLAG)
      if (
        stored === 'cash' ||
        stored === 'cashflow' ||
        stored === 'receivables' ||
        stored === 'debts' ||
        stored === 'expenses' ||
        stored === 'ledger'
      ) {
        sessionStorage.removeItem(FINANCE_TAB_FLAG)
        const timer = window.setTimeout(() => setTab(stored), 0)
        return () => window.clearTimeout(timer)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (tab !== 'receivables' || ledgerCustomers.length === 0) return
    let timer: number | undefined
    try {
      const raw = sessionStorage.getItem('velora.finance.receivableCustomerId')
      if (!raw) return
      sessionStorage.removeItem('velora.finance.receivableCustomerId')
      const customerId = Number(raw)
      const row = ledgerCustomers.find((item) => item.customerId === customerId)
      if (row) timer = window.setTimeout(() => setLedgerSearch(row.customerName), 0)
    } catch {
      // ignore
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [tab, ledgerCustomers])

  const resetCashForm = () => {
    setCashType('CASH_IN')
    setCashAmount('')
    setCashTransactionAt(todayYmd())
    setCashCategory('')
    setCashDescription('')
    setCashCustomerId('')
    setCashAccountId('')
    setCashFormError('')
  }

  const resetCollectionForm = () => {
    setCollectionCustomerId('')
    setCollectionAmount('')
    setCollectionTransactionAt(todayYmd())
    setCollectionDescription('')
    setCollectionAccountId('')
    setCollectionFormError('')
  }

  const openCash = () => {
    resetCashForm()
    setCashOpen(true)
  }

  const openCollection = () => {
    resetCollectionForm()
    setCollectionOpen(true)
  }

  useEffect(() => {
    if (!canWrite) return
    let timer: number | undefined
    try {
      const shouldOpenCash = sessionStorage.getItem(OPEN_CASH_FLAG) === '1'
      const shouldOpenCollection = sessionStorage.getItem(OPEN_COLLECTION_FLAG) === '1'
      if (shouldOpenCash) {
        sessionStorage.removeItem(OPEN_CASH_FLAG)
      }
      if (shouldOpenCollection) {
        sessionStorage.removeItem(OPEN_COLLECTION_FLAG)
      }
      timer = window.setTimeout(() => {
        if (shouldOpenCash) {
          resetCashForm()
          setCashOpen(true)
        }
        if (shouldOpenCollection) {
          resetCollectionForm()
          setCollectionOpen(true)
        }
      }, 0)
    } catch {
      // ignore storage errors
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [canWrite])

  const handleCashSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    const amt = Number(cashAmount)
    if (!Number.isFinite(amt) || amt < 0.01) {
      setCashFormError(t('finance.invalidAmount'))
      return
    }
    if (!cashCategory.trim() || !cashDescription.trim()) {
      setCashFormError(t('finance.categoryDescriptionRequired'))
      return
    }
    setSaving(true)
    setCashFormError('')
    setError('')
    try {
      await apiPost('/cash/transactions', {
        type: cashType,
        amount: amt,
        transactionAt: cashTransactionAt,
        category: cashCategory.trim(),
        description: cashDescription.trim(),
        relatedCustomerId: cashCustomerId ? Number(cashCustomerId) : undefined,
        cashAccountId: cashAccountId ? Number(cashAccountId) : undefined,
      })
      setCashOpen(false)
      resetCashForm()
      await load()
    } catch (err) {
      setCashFormError(
        err instanceof ApiError ? err.message : t('finance.cashSaveError'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCollectionSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!collectionCustomerId) {
      setCollectionFormError(t('finance.selectCustomer'))
      return
    }
    const amt = Number(collectionAmount)
    if (!Number.isFinite(amt) || amt < 0.01) {
      setCollectionFormError(t('finance.invalidAmount'))
      return
    }
    if (!collectionDescription.trim()) {
      setCollectionFormError(t('finance.descriptionRequired'))
      return
    }
    setSaving(true)
    setCollectionFormError('')
    setError('')
    try {
      await apiPost('/cash/collections', {
        customerId: Number(collectionCustomerId),
        amount: amt,
        transactionAt: collectionTransactionAt,
        description: collectionDescription.trim(),
        cashAccountId: collectionAccountId
          ? Number(collectionAccountId)
          : undefined,
      })
      setCollectionOpen(false)
      resetCollectionForm()
      await load()
    } catch (err) {
      setCollectionFormError(
        err instanceof ApiError ? err.message : t('finance.collectionSaveError'),
      )
    } finally {
      setSaving(false)
    }
  }

  const handleReverse = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || !reverseTarget || saving) return
    if (reverseReason.trim().length < 3) {
      setReverseError(t('finance.reverseReason'))
      return
    }
    setSaving(true)
    setReverseError('')
    try {
      await apiPost(`/cash/transactions/${reverseTarget.id}/reverse`, {
        reason: reverseReason.trim(),
      })
      setReverseTarget(null)
      setReverseReason('')
      setSuccessNotice(t('finance.reverseSaved'))
      await load()
    } catch (err) {
      setReverseError(err instanceof ApiError ? err.message : t('finance.reverseError'))
    } finally {
      setSaving(false)
    }
  }

  const filteredCash = useMemo(() => {
    const query = search.toLocaleLowerCase(locale)
    return transactions.filter((transaction) =>
      [transaction.description, transaction.cashAccount?.name, transaction.cashAccount?.code]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase(locale).includes(query)),
    )
  }, [locale, search, transactions])

  const filteredLedger = useMemo(() => {
    const query = ledgerSearch.toLocaleLowerCase(locale)
    return ledgerCustomers.filter((row) =>
      row.customerName.toLocaleLowerCase(locale).includes(query),
    )
  }, [ledgerSearch, ledgerCustomers, locale])

  const totalBalance = accounts.reduce((total, account) => total + amount(account.balance), 0)
  const totalReceivable = ledgerCustomers
    .filter((row) => row.balance > 0)
    .reduce((sum, row) => sum + row.balance, 0)
  const ledgerMovementCount = ledgerCustomers.reduce((sum, row) => sum + row.transactionCount, 0)
  const receivableRows = filteredLedger.filter((row) => row.balance > 0)
  const expenseRows = filteredCash.filter((row) => amount(row.credit) > 0)

  return (
    <>
      <div className="module-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={tab === 'cash' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('cash')}>{t('finance.tab.cash')}</button>
        <button type="button" className={tab === 'cashflow' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('cashflow')}>{t('finance.tab.cashflow')}</button>
        <button type="button" className={tab === 'receivables' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('receivables')}>{t('finance.tab.receivables')}</button>
        <button type="button" className={tab === 'debts' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('debts')}>{t('finance.tab.debts')}</button>
        <button type="button" className={tab === 'expenses' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('expenses')}>{t('finance.tab.expenses')}</button>
        <button type="button" className={tab === 'ledger' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('ledger')}>{t('finance.tab.ledger')}</button>
      </div>

      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />

      {tab !== 'debts' && tab !== 'cashflow' && (
      <ModuleSummary
        items={[
          { label: t('finance.cashBalance'), value: formatAmount(totalBalance), unit: 'DZD' },
          { label: t('finance.cashMovements'), value: String(transactions.length) },
          { label: t('finance.customerReceivable'), value: formatAmount(totalReceivable), unit: 'DZD' },
          { label: t('finance.ledgerMovements'), value: String(ledgerMovementCount) },
        ]}
      />
      )}

      {tab === 'debts' && <FinanceDebtsTab canWrite={canWrite} />}
      {tab === 'cashflow' && (
        <CashFlowTab
          onOpenDebt={(supplierId) => {
            try {
              sessionStorage.setItem('velora.finance.debtSupplierId', String(supplierId))
            } catch {
              // ignore
            }
            setTab('debts')
          }}
          onOpenReceivable={(customerId) => {
            try {
              sessionStorage.setItem('velora.finance.receivableCustomerId', String(customerId))
            } catch {
              // ignore
            }
            setTab('receivables')
          }}
        />
      )}

      {tab === 'ledger' && (
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('finance.ledgerTitle')}</h2>
          <p className="panel__meta">{t('finance.customerLedgerOnly')}</p>
          <span className="panel__meta">
            {loading ? t('common.loading') : t('finance.customerCount', { count: filteredLedger.length })}
          </span>
        </div>
        <ModuleToolbar
          reportType="cash"
          reportLabel={t('finance.cashReport')}
          search={ledgerSearch}
          onSearchChange={setLedgerSearch}
          searchPlaceholder={t('finance.searchCustomer')}
        />
        <p className="finance-notes" style={{ marginBottom: 12 }}>
          {t('finance.ledgerMeaning')}
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('finance.customer')}</th>
                <th>{t('finance.totalSales')}</th>
                <th>{t('finance.totalCollections')}</th>
                <th>{t('finance.totalReturns')}</th>
                <th>{t('finance.currentBalance')}</th>
                <th>{t('finance.lastMovement')}</th>
                <th>{t('finance.review')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedger.map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td className="amount-cell">{formatAmount(row.totalSales)}</td>
                  <td className="amount-cell">{formatAmount(row.totalPayments)}</td>
                  <td className="amount-cell">{formatAmount(row.totalReturns)}</td>
                  <td className="amount-cell">{formatAmount(row.balance)}</td>
                  <td className="date-cell">{row.lastMovementAt ? formatDate(row.lastMovementAt) : '—'}</td>
                  <td>{row.reviewRequired ? t('finance.reviewRequired') : '—'}</td>
                </tr>
              ))}
              {!loading && filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    {t('finance.noLedger')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {tab === 'receivables' && (
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('finance.receivables')}</h2>
          <span className="panel__meta">{t('finance.customerDebtHint')}</span>
        </div>
        <ModuleToolbar
          reportType="ledger"
          reportLabel={t('finance.ledgerReport')}
          search={ledgerSearch}
          onSearchChange={setLedgerSearch}
          searchPlaceholder={t('finance.searchCustomer')}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('finance.customer')}</th>
                <th>{t('finance.totalSales')}</th>
                <th>{t('finance.totalCollections')}</th>
                <th>{t('finance.remainingReceivable')}</th>
                <th>{t('finance.lastMovement')}</th>
              </tr>
            </thead>
            <tbody>
              {receivableRows.map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td className="amount-cell">{formatAmount(row.totalSales)}</td>
                  <td className="amount-cell">{formatAmount(row.totalPayments)}</td>
                  <td className="amount-cell">{formatAmount(row.balance)}</td>
                  <td className="date-cell">{row.lastMovementAt ? formatDate(row.lastMovementAt) : '—'}</td>
                </tr>
              ))}
              {!loading && receivableRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    {t('finance.noReceivables')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {tab === 'expenses' && (
      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('finance.expenses')}</h2>
          <span className="panel__meta">{t('finance.cashOutHint')}</span>
        </div>
        <ModuleToolbar
          reportType="cash"
          reportLabel={t('finance.cashReport')}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('finance.searchDescription')}
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('finance.date')}</th>
                <th>{t('finance.description')}</th>
                <th>{t('finance.cashAccount')}</th>
                <th>{t('finance.amountDzd')}</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row) => (
                <tr key={row.id}>
                  <td className="date-cell">{formatDate(row.transactionAt)}</td>
                  <td>{row.description}</td>
                  <td>{row.cashAccount?.name ?? '—'}</td>
                  <td className="amount-cell">{formatAmount(row.credit)}</td>
                </tr>
              ))}
              {!loading && expenseRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-cell">{t('finance.noExpenses')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {tab === 'cash' && (
      <div className="finance-grid">
        <section className="panel panel--full">
          <div className="panel__header">
            <h2>{t('finance.cashTransactions')}</h2>
            {canWrite ? (
              <div className="form-actions" style={{ margin: 0 }}>
                <button type="button" className="btn btn--primary" onClick={openCash}>
                  + {t('finance.newCashMovement')}
                </button>
                <button type="button" className="btn btn--ghost" onClick={openCollection}>
                  + {t('finance.collection')}
                </button>
              </div>
            ) : (
              <span className="panel__meta">
                {loading ? t('common.loading') : t('finance.recordCount', { count: filteredCash.length })}
              </span>
            )}
          </div>
          <ModuleToolbar
            reportType="ledger"
            reportLabel={t('finance.ledgerReport')}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('finance.searchCash')}
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
                  <th>{t('finance.date')}</th>
                  <th>{t('finance.description')}</th>
                  <th>{t('finance.cashAccount')}</th>
                  <th>{t('finance.debitDzd')}</th>
                  <th>{t('finance.creditDzd')}</th>
                  <th>{t('finance.balanceDzd')}</th>
                  {canWrite && <th>{t('finance.action')}</th>}
                </tr>
              </thead>
              <tbody>
                {filteredCash.map((row) => (
                  <tr key={row.id}>
                    <td className="date-cell">
                      {formatDate(row.transactionAt)}
                    </td>
                    <td>{row.description}</td>
                    <td>{row.cashAccount?.name ?? '—'}</td>
                    <td className="amount-cell">{formatAmount(row.debit)}</td>
                    <td className="amount-cell">{formatAmount(row.credit)}</td>
                    <td className="amount-cell">
                      {row.balance === null ? '—' : formatAmount(row.balance)}
                    </td>
                    {canWrite && (
                      <td>
                        {!row.reversesId && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() => {
                              setReverseTarget(row)
                              setReverseReason('')
                              setReverseError('')
                            }}
                          >
                            {t('finance.reverse')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {!loading && !error && filteredCash.length === 0 && (
                  <tr>
                    <td colSpan={canWrite ? 7 : 6} className="empty-cell">
                      {t('finance.noCashMovements')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>{t('finance.cashAccounts')}</h2>
            <span className="panel__meta">{t('finance.accountCount', { count: accounts.length })}</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('finance.account')}</th>
                  <th>{t('finance.currency')}</th>
                  <th>{t('finance.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{account.currency}</td>
                    <td className="amount-cell">{formatAmount(account.balance)}</td>
                  </tr>
                ))}
                {!loading && !error && accounts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="empty-cell">
                      {t('finance.noCashAccounts')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="finance-notes">
            <p>
              {t('finance.currency')}: <strong>DZD</strong>
            </p>
            <p>
              {t('finance.timezone')}: <strong>Africa/Algiers</strong>
            </p>
          </div>
        </section>
      </div>
      )}

      <Modal
        open={cashOpen}
        title={t('finance.newCashMovement')}
        onClose={() => {
          setCashOpen(false)
          setCashFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCashSubmit(e)}>
          <label>
            {t('finance.type')}
            <select
              dir="ltr"
              value={cashType}
              onChange={(e) => setCashType(e.target.value as CashType)}
            >
              <option value="CASH_IN">{t('finance.cashType.CASH_IN')}</option>
              <option value="CASH_OUT">{t('finance.cashType.CASH_OUT')}</option>
            </select>
          </label>
          <label>
            {t('finance.amountDzd')}
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              dir="ltr"
              value={cashAmount}
              onChange={(e) => setCashAmount(e.target.value)}
            />
          </label>
          <label>
            {t('finance.date')}
            <input
              type="date"
              required
              dir="ltr"
              value={cashTransactionAt}
              onChange={(e) => setCashTransactionAt(e.target.value)}
            />
          </label>
          <label>
            {t('finance.category')}
            <input
              required
              dir="ltr"
              value={cashCategory}
              onChange={(e) => setCashCategory(e.target.value)}
              placeholder={t('finance.categoryPlaceholder')}
            />
          </label>
          <label>
            {t('finance.description')}
            <input
              required
              dir="ltr"
              value={cashDescription}
              onChange={(e) => setCashDescription(e.target.value)}
            />
          </label>
          <label>
            {t('finance.relatedCustomer')}
            <select
              dir="ltr"
              value={cashCustomerId}
              onChange={(e) => setCashCustomerId(e.target.value)}
            >
              <option value="">{t('finance.none')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('finance.optionalCashAccount')}
            <select
              dir="ltr"
              value={cashAccountId}
              onChange={(e) => setCashAccountId(e.target.value)}
            >
              <option value="">{t('finance.default')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
          {cashFormError && (
            <p className="demo-notice" role="alert">
              {cashFormError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setCashOpen(false)
                setCashFormError('')
              }}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t('finance.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={collectionOpen}
        title={t('finance.collection')}
        onClose={() => {
          setCollectionOpen(false)
          setCollectionFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCollectionSubmit(e)}>
          <label>
            {t('finance.customer')}
            <select
              required
              dir="ltr"
              value={collectionCustomerId}
              onChange={(e) => setCollectionCustomerId(e.target.value)}
            >
              <option value="">{t('finance.select')}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('finance.amountDzd')}
            <input
              type="number"
              min="0.01"
              step="0.01"
              required
              dir="ltr"
              value={collectionAmount}
              onChange={(e) => setCollectionAmount(e.target.value)}
            />
          </label>
          <label>
            {t('finance.date')}
            <input
              type="date"
              required
              dir="ltr"
              value={collectionTransactionAt}
              onChange={(e) => setCollectionTransactionAt(e.target.value)}
            />
          </label>
          <label>
            {t('finance.description')}
            <input
              required
              dir="ltr"
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
            />
          </label>
          <label>
            {t('finance.optionalCashAccount')}
            <select
              dir="ltr"
              value={collectionAccountId}
              onChange={(e) => setCollectionAccountId(e.target.value)}
            >
              <option value="">{t('finance.default')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
          {customers.length === 0 && (
            <p className="demo-notice" role="status">
              {t('finance.createCustomerFirst')}
            </p>
          )}
          {collectionFormError && (
            <p className="demo-notice" role="alert">
              {collectionFormError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setCollectionOpen(false)
                setCollectionFormError('')
              }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || customers.length === 0}
            >
              {saving ? t('finance.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(reverseTarget)}
        title={t('finance.reverseTitle')}
        onClose={() => {
          if (saving) return
          setReverseTarget(null)
          setReverseReason('')
          setReverseError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleReverse(e)}>
          {reverseTarget && (
            <p className="panel__meta" style={{ marginBottom: 8 }}>
              {reverseTarget.description}
            </p>
          )}
          <label>
            {t('finance.reverseReason')}
            <textarea
              rows={3}
              required
              minLength={3}
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </label>
          {reverseError && (
            <p className="demo-notice" role="alert">
              {reverseError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              disabled={saving}
              onClick={() => {
                setReverseTarget(null)
                setReverseReason('')
                setReverseError('')
              }}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t('finance.saving') : t('finance.reverse')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
