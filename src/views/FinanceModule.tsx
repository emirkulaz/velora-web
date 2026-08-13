import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { ApiError, apiGet, apiPost } from '../data/api'
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

function formatAmount(value: Amount | null | undefined) {
  return amount(value).toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Africa/Algiers' })
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

  const load = async () => {
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
      setError('Finans verileri henüz alınamadı. API bağlantısını kontrol edin.')
      setTransactions([])
      setAccounts([])
      setLedgerCustomers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

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
        setTab(stored)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (tab !== 'receivables' || ledgerCustomers.length === 0) return
    try {
      const raw = sessionStorage.getItem('velora.finance.receivableCustomerId')
      if (!raw) return
      sessionStorage.removeItem('velora.finance.receivableCustomerId')
      const customerId = Number(raw)
      const row = ledgerCustomers.find((item) => item.customerId === customerId)
      if (row) setLedgerSearch(row.customerName)
    } catch {
      // ignore
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
    try {
      if (sessionStorage.getItem(OPEN_CASH_FLAG) === '1') {
        sessionStorage.removeItem(OPEN_CASH_FLAG)
        resetCashForm()
        setCashOpen(true)
      }
      if (sessionStorage.getItem(OPEN_COLLECTION_FLAG) === '1') {
        sessionStorage.removeItem(OPEN_COLLECTION_FLAG)
        resetCollectionForm()
        setCollectionOpen(true)
      }
    } catch {
      // ignore storage errors
    }
  }, [canWrite])

  const handleCashSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    const amt = Number(cashAmount)
    if (!Number.isFinite(amt) || amt < 0.01) {
      setCashFormError('Geçerli bir tutar girin.')
      return
    }
    if (!cashCategory.trim() || !cashDescription.trim()) {
      setCashFormError('Kategori ve açıklama zorunludur.')
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
        err instanceof ApiError ? err.message : 'Kasa hareketi kaydedilemedi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCollectionSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!collectionCustomerId) {
      setCollectionFormError('Müşteri seçin.')
      return
    }
    const amt = Number(collectionAmount)
    if (!Number.isFinite(amt) || amt < 0.01) {
      setCollectionFormError('Geçerli bir tutar girin.')
      return
    }
    if (!collectionDescription.trim()) {
      setCollectionFormError('Açıklama zorunludur.')
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
        err instanceof ApiError ? err.message : 'Tahsilat kaydedilemedi.',
      )
    } finally {
      setSaving(false)
    }
  }

  const filteredCash = useMemo(() => {
    const query = search.toLocaleLowerCase('tr-TR')
    return transactions.filter((transaction) =>
      [transaction.description, transaction.cashAccount?.name, transaction.cashAccount?.code]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('tr-TR').includes(query)),
    )
  }, [search, transactions])

  const filteredLedger = useMemo(() => {
    const query = ledgerSearch.toLocaleLowerCase('tr-TR')
    return ledgerCustomers.filter((row) =>
      row.customerName.toLocaleLowerCase('tr-TR').includes(query),
    )
  }, [ledgerSearch, ledgerCustomers])

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
        <button type="button" className={tab === 'cash' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('cash')}>Kasa</button>
        <button type="button" className={tab === 'cashflow' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('cashflow')}>Nakit Akışı</button>
        <button type="button" className={tab === 'receivables' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('receivables')}>Alacaklarım</button>
        <button type="button" className={tab === 'debts' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('debts')}>Borçlarım</button>
        <button type="button" className={tab === 'expenses' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('expenses')}>Giderler</button>
        <button type="button" className={tab === 'ledger' ? 'module-tab module-tab--active' : 'module-tab'} onClick={() => setTab('ledger')}>Cari Hesaplar</button>
      </div>

      {tab !== 'debts' && tab !== 'cashflow' && (
      <ModuleSummary
        items={[
          { label: 'Kasa Bakiyesi', value: formatAmount(totalBalance), unit: 'DZD' },
          { label: 'Kasa Hareketi', value: String(transactions.length) },
          { label: 'Müşteri Alacağı', value: formatAmount(totalReceivable), unit: 'DZD' },
          { label: 'Cari Hareket', value: String(ledgerMovementCount) },
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
          <h2>Cari Hesaplar</h2>
          <p className="panel__meta">Müşteri carisi — tedarikçi borcu burada değil</p>
          <span className="panel__meta">
            {loading ? 'Yükleniyor…' : `${filteredLedger.length} müşteri`}
          </span>
        </div>
        <ModuleToolbar
          reportType="cash"
          reportLabel="Kasa Raporu"
          search={ledgerSearch}
          onSearchChange={setLedgerSearch}
          searchPlaceholder="Müşteri ara..."
        />
        <p className="finance-notes" style={{ marginBottom: 12 }}>
          Pozitif bakiye: müşteri bize borçlu. Negatif bakiye: müşteri alacaklı veya avanslı.
          Yalnızca Excel aktarımı ve VEXOR’da oluşturulan hareketler gösterilir (DEMO yok).
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Müşteri</th>
                <th>Toplam Satış</th>
                <th>Toplam Tahsilat</th>
                <th>Toplam İade</th>
                <th>Güncel Bakiye</th>
                <th>Son Hareket</th>
                <th>İnceleme</th>
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
                  <td className="date-cell">{formatDate(row.lastMovementAt)}</td>
                  <td>{row.reviewRequired ? 'REVIEW_REQUIRED' : '—'}</td>
                </tr>
              ))}
              {!loading && filteredLedger.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Henüz cari hareket aktarılmadı. Excel import onayından sonra burada görünecek.
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
          <h2>Alacaklarım</h2>
          <span className="panel__meta">Müşterilerin şirkete borcu</span>
        </div>
        <ModuleToolbar
          reportType="ledger"
          reportLabel="Cari Raporu"
          search={ledgerSearch}
          onSearchChange={setLedgerSearch}
          searchPlaceholder="Müşteri ara..."
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Müşteri</th>
                <th>Toplam Satış</th>
                <th>Toplam Tahsilat</th>
                <th>Kalan Alacak</th>
                <th>Son Hareket</th>
              </tr>
            </thead>
            <tbody>
              {receivableRows.map((row) => (
                <tr key={row.customerId}>
                  <td>{row.customerName}</td>
                  <td className="amount-cell">{formatAmount(row.totalSales)}</td>
                  <td className="amount-cell">{formatAmount(row.totalPayments)}</td>
                  <td className="amount-cell">{formatAmount(row.balance)}</td>
                  <td className="date-cell">{formatDate(row.lastMovementAt)}</td>
                </tr>
              ))}
              {!loading && receivableRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    Açık müşteri alacağı yok.
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
          <h2>Giderler</h2>
          <span className="panel__meta">Kasa çıkışları (CASH_OUT)</span>
        </div>
        <ModuleToolbar
          reportType="cash"
          reportLabel="Kasa Raporu"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Açıklama ara..."
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Açıklama</th>
                <th>Kasa</th>
                <th>Tutar (DZD)</th>
              </tr>
            </thead>
            <tbody>
              {expenseRows.map((row) => (
                <tr key={row.id}>
                  <td className="date-cell">{new Date(row.transactionAt).toLocaleDateString('tr-TR')}</td>
                  <td>{row.description}</td>
                  <td>{row.cashAccount?.name ?? '—'}</td>
                  <td className="amount-cell">{formatAmount(row.credit)}</td>
                </tr>
              ))}
              {!loading && expenseRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="empty-cell">Henüz gider hareketi yok.</td>
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
            <h2>Kasa Hareketleri</h2>
            {canWrite ? (
              <div className="form-actions" style={{ margin: 0 }}>
                <button type="button" className="btn btn--primary" onClick={openCash}>
                  + Kasa hareketi
                </button>
                <button type="button" className="btn btn--ghost" onClick={openCollection}>
                  + Tahsilat
                </button>
              </div>
            ) : (
              <span className="panel__meta">
                {loading ? 'Yükleniyor…' : `${filteredCash.length} kayıt`}
              </span>
            )}
          </div>
          <ModuleToolbar
            reportType="ledger"
            reportLabel="Cari Raporu"
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Açıklama veya kasa hesabı ara..."
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
                  <th>Tarih</th>
                  <th>Açıklama</th>
                  <th>Kasa</th>
                  <th>Borç (DZD)</th>
                  <th>Alacak (DZD)</th>
                  <th>Bakiye (DZD)</th>
                </tr>
              </thead>
              <tbody>
                {filteredCash.map((t) => (
                  <tr key={t.id}>
                    <td className="date-cell">
                      {new Date(t.transactionAt).toLocaleDateString('tr-TR')}
                    </td>
                    <td>{t.description}</td>
                    <td>{t.cashAccount?.name ?? '—'}</td>
                    <td className="amount-cell">{formatAmount(t.debit)}</td>
                    <td className="amount-cell">{formatAmount(t.credit)}</td>
                    <td className="amount-cell">
                      {t.balance === null ? '—' : formatAmount(t.balance)}
                    </td>
                  </tr>
                ))}
                {!loading && !error && filteredCash.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      Henüz kasa hareketi aktarılmadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel__header">
            <h2>Kasa Hesapları</h2>
            <span className="panel__meta">{accounts.length} hesap</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hesap</th>
                  <th>Para Birimi</th>
                  <th>Bakiye</th>
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
                      Henüz kasa hesabı oluşturulmadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="finance-notes">
            <p>
              Para birimi: <strong>DZD</strong>
            </p>
            <p>
              Saat dilimi: <strong>Africa/Algiers</strong>
            </p>
          </div>
        </section>
      </div>
      )}

      <Modal
        open={cashOpen}
        title="Kasa hareketi"
        onClose={() => {
          setCashOpen(false)
          setCashFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCashSubmit(e)}>
          <label>
            Tip
            <select
              dir="ltr"
              value={cashType}
              onChange={(e) => setCashType(e.target.value as CashType)}
            >
              <option value="CASH_IN">Giriş (CASH_IN)</option>
              <option value="CASH_OUT">Çıkış (CASH_OUT)</option>
            </select>
          </label>
          <label>
            Tutar (DZD)
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
            Tarih
            <input
              type="date"
              required
              dir="ltr"
              value={cashTransactionAt}
              onChange={(e) => setCashTransactionAt(e.target.value)}
            />
          </label>
          <label>
            Kategori
            <input
              required
              dir="ltr"
              value={cashCategory}
              onChange={(e) => setCashCategory(e.target.value)}
              placeholder="Örn. Satış, Gider, Transfer"
            />
          </label>
          <label>
            Açıklama
            <input
              required
              dir="ltr"
              value={cashDescription}
              onChange={(e) => setCashDescription(e.target.value)}
            />
          </label>
          <label>
            İlişkili müşteri (opsiyonel)
            <select
              dir="ltr"
              value={cashCustomerId}
              onChange={(e) => setCashCustomerId(e.target.value)}
            >
              <option value="">Yok</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Kasa hesabı (opsiyonel)
            <select
              dir="ltr"
              value={cashAccountId}
              onChange={(e) => setCashAccountId(e.target.value)}
            >
              <option value="">Varsayılan</option>
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
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={collectionOpen}
        title="Tahsilat"
        onClose={() => {
          setCollectionOpen(false)
          setCollectionFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCollectionSubmit(e)}>
          <label>
            Müşteri
            <select
              required
              dir="ltr"
              value={collectionCustomerId}
              onChange={(e) => setCollectionCustomerId(e.target.value)}
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
            Tutar (DZD)
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
            Tarih
            <input
              type="date"
              required
              dir="ltr"
              value={collectionTransactionAt}
              onChange={(e) => setCollectionTransactionAt(e.target.value)}
            />
          </label>
          <label>
            Açıklama
            <input
              required
              dir="ltr"
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
            />
          </label>
          <label>
            Kasa hesabı (opsiyonel)
            <select
              dir="ltr"
              value={collectionAccountId}
              onChange={(e) => setCollectionAccountId(e.target.value)}
            >
              <option value="">Varsayılan</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </label>
          {customers.length === 0 && (
            <p className="demo-notice" role="status">
              Önce müşteri kaydı oluşturun.
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
              Vazgeç
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || customers.length === 0}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

/** Günlük İşler vb. → kasa hareketi modalını açar. */
export function markOpenFinanceCash(): void {
  try {
    sessionStorage.setItem(OPEN_CASH_FLAG, '1')
  } catch {
    // ignore
  }
}

/** Günlük İşler vb. → tahsilat modalını açar. */
export function markOpenFinanceCollection(): void {
  try {
    sessionStorage.setItem(OPEN_COLLECTION_FLAG, '1')
  } catch {
    // ignore
  }
}
