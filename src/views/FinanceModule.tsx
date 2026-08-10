import { useEffect, useMemo, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiGet } from '../data/api'

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

export function FinanceModule() {
  const [search, setSearch] = useState('')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [accounts, setAccounts] = useState<CashAccountSummary[]>([])
  const [ledgerCustomers, setLedgerCustomers] = useState<LedgerCustomerSummary[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      apiGet<CashTransaction[]>('/cash/transactions'),
      apiGet<unknown>('/cash/summary'),
      apiGet<LedgerSummaryResponse>('/customer-ledger/summary').catch(() => null),
    ])
      .then(([cashTransactions, cashSummary, ledgerSummary]) => {
        setTransactions(Array.isArray(cashTransactions) ? cashTransactions : [])
        setAccounts(normalizeAccounts(cashSummary))
        setLedgerCustomers(ledgerSummary?.customers ?? [])
        setError('')
      })
      .catch(() => {
        setError('Finans verileri henüz alınamadı. API bağlantısını kontrol edin.')
        setTransactions([])
        setAccounts([])
        setLedgerCustomers([])
      })
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Kasa Bakiyesi', value: formatAmount(totalBalance), unit: 'DZD' },
          { label: 'Kasa Hareketi', value: String(transactions.length) },
          { label: 'Cari Alacak', value: formatAmount(totalReceivable), unit: 'DZD' },
          { label: 'Cari Hareket', value: String(ledgerMovementCount) },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Cari Hesaplar</h2>
          <span className="panel__meta">
            {loading ? 'Yükleniyor…' : `${filteredLedger.length} müşteri`}
          </span>
        </div>
        <ModuleToolbar
          search={ledgerSearch}
          onSearchChange={setLedgerSearch}
          searchPlaceholder="Müşteri ara..."
        />
        <p className="finance-notes" style={{ marginBottom: 12 }}>
          Pozitif bakiye: müşteri bize borçlu. Negatif bakiye: müşteri alacaklı veya avanslı.
          Yalnızca Excel aktarımı ve Velora’da oluşturulan hareketler gösterilir (DEMO yok).
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

      <div className="finance-grid">
        <section className="panel panel--full">
          <div className="panel__header">
            <h2>Kasa Hareketleri</h2>
            <span className="panel__meta">
              {loading ? 'Yükleniyor…' : `${filteredCash.length} kayıt`}
            </span>
          </div>
          <ModuleToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Açıklama veya kasa hesabı ara..."
          />
          {error && <p className="demo-notice">{error}</p>}
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
            <p>
              Beklenen kasa (import sonrası): <strong>49.390 DZD</strong>
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
