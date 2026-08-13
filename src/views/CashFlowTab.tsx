import { useEffect, useMemo, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ApiError, apiGet } from '../data/api'

type Liquidity = 'SAFE' | 'WATCH' | 'RISK'

type CashFlowSnapshot = {
  date: string
  currency: string
  kpis: {
    currentCash: number
    collections30d: number
    inflow30d: number
    outflow30d: number
    netCashChange30d: number
    upcomingPayments7d: number
    overdueDebt: number
    expectedCollections7d: number | null
    projectedCash7d: number
    liquidity: Liquidity
  }
  flow: Array<{ date: string; inflow: number; outflow: number; net: number }>
  calendar: Array<{
    supplierId: number
    supplierName: string
    amount: number
    dueDate: string
    purchaseOrderId: number | null
    goodsReceiptId: number | null
    orderNo: string | null
    ledgerId: number
  }>
  expectedCollections: Array<{
    customerId: number
    customerName: string
    amount: number
    dueDate: string
  }>
  expectedCollectionsNotice: string | null
  expectedCollectionsReliable: boolean
}

const RISK_LABEL: Record<Liquidity, string> = {
  SAFE: 'Güvenli',
  WATCH: 'İzle',
  RISK: 'Risk',
}

function money(value: number, currency: string) {
  return `${value.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

function formatDay(ymd: string) {
  return new Date(`${ymd}T12:00:00`).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Africa/Algiers',
  })
}

function CashFlowChart({
  data,
  currency,
}: {
  data: CashFlowSnapshot['flow']
  currency: string
}) {
  const w = 720
  const h = 240
  const p = 32
  const max = Math.max(...data.flatMap((d) => [d.inflow, d.outflow, Math.abs(d.net)]), 1)
  const group = (w - p * 2) / Math.max(data.length, 1)
  const bar = Math.max(2, group * 0.28)
  const ticks = data.filter((_, i) => i === 0 || i === data.length - 1 || i % 7 === 0)
  return (
    <svg className="executive-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="30 günlük nakit grafiği">
      {[0, 0.5, 1].map((x) => (
        <line key={x} x1={p} x2={w - p} y1={p + x * (h - p * 2)} y2={p + x * (h - p * 2)} className="chart-grid" />
      ))}
      {data.map((d, i) => {
        const x = p + i * group + group / 2
        const ih = (d.inflow / max) * (h - p * 2)
        const eh = (d.outflow / max) * (h - p * 2)
        return (
          <g key={d.date}>
            <rect x={x - bar - 1} y={h - p - ih} width={bar} height={ih} rx="2" className="bar-income" />
            <rect x={x + 1} y={h - p - eh} width={bar} height={eh} rx="2" className="bar-expense" />
          </g>
        )
      })}
      <polyline
        className="chart-line"
        points={data
          .map((d, i) => {
            const x = p + i * group + group / 2
            const y = h - p - ((d.net + max) / (2 * max)) * (h - p * 2)
            return `${x},${y}`
          })
          .join(' ')}
      />
      {ticks.map((d) => {
        const i = data.indexOf(d)
        return (
          <text key={d.date} x={p + i * group + group / 2} y={h - 8} textAnchor="middle">
            {d.date.slice(8)}
          </text>
        )
      })}
      <text x={w - 8} y={14} textAnchor="end" className="chart-unit">
        {currency}
      </text>
    </svg>
  )
}

export function CashFlowTab({
  onOpenDebt,
  onOpenReceivable,
}: {
  onOpenDebt?: (supplierId: number) => void
  onOpenReceivable?: (customerId: number) => void
}) {
  const [data, setData] = useState<CashFlowSnapshot | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    apiGet<CashFlowSnapshot>('/cash-flow')
      .then((snapshot) => {
        if (live) setData(snapshot)
      })
      .catch((err) => {
        if (live) setError(err instanceof ApiError ? err.message : 'Nakit akışı alınamadı.')
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const groupedCalendar = useMemo(() => {
    if (!data) return []
    const map = new Map<string, CashFlowSnapshot['calendar']>()
    for (const row of data.calendar) {
      const list = map.get(row.dueDate) ?? []
      list.push(row)
      map.set(row.dueDate, list)
    }
    return [...map.entries()]
  }, [data])

  if (loading) return <p className="demo-notice">Nakit akışı yükleniyor…</p>
  if (error || !data) return <p className="demo-notice" role="alert">{error || 'Nakit akışı verisi bulunamadı.'}</p>

  const k = data.kpis

  return (
    <section className="panel panel--full cashflow-panel">
      <div className="panel__header">
        <h2>Nakit Akışı</h2>
        <p className="panel__meta">Kasa hareketi + tedarikçi vadeleri · sipariş cirosu nakit değildir</p>
      </div>

      <ModuleSummary
        items={[
          { label: 'Mevcut Nakit', value: money(k.currentCash, data.currency) },
          { label: 'Son 30 Gün Tahsilat', value: money(k.collections30d, data.currency) },
          { label: 'Son 30 Gün Gider/Ödeme', value: money(k.outflow30d, data.currency) },
          { label: 'Önümüzdeki 7 Gün Ödenecek', value: money(k.upcomingPayments7d, data.currency) },
          { label: 'Vadesi Geçmiş Borç', value: money(k.overdueDebt, data.currency) },
          { label: 'Net Nakit Değişimi', value: money(k.netCashChange30d, data.currency) },
        ]}
      />

      <article className={`cashflow-liquidity cashflow-liquidity--${k.liquidity}`}>
        <div>
          <span>7 günlük likidite tahmini</span>
          <strong>{money(k.projectedCash7d, data.currency)}</strong>
          <small>
            Mevcut nakit {money(k.currentCash, data.currency)} − bilinen ödemeler{' '}
            {money(k.upcomingPayments7d, data.currency)}
            {k.expectedCollections7d != null
              ? ` + doğrulanmış tahsilat ${money(k.expectedCollections7d, data.currency)}`
              : ' · doğrulanmamış tahsilat dahil edilmedi'}
          </small>
        </div>
        <b>{RISK_LABEL[k.liquidity]}</b>
      </article>

      <section className="cashflow-section">
        <header>
          <h3>30 günlük gerçek nakit</h3>
          <div className="chart-legend">
            <i className="legend-income" /> Para girişi
            <i className="legend-expense" /> Para çıkışı
            <span className="cashflow-net-legend">Net değişim</span>
          </div>
        </header>
        <CashFlowChart data={data.flow} currency={data.currency} />
      </section>

      <section className="cashflow-section">
        <h3>7 günlük ödeme takvimi</h3>
        {groupedCalendar.length === 0 ? (
          <p className="empty-state">Önümüzdeki 7 günde vadesi gelen tedarikçi ödemesi yok.</p>
        ) : (
          groupedCalendar.map(([dueDate, rows]) => (
            <div className="cashflow-calendar__day" key={dueDate}>
              <h4>{formatDay(dueDate)}</h4>
              <div className="table-wrap">
                <table className="data-table">
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={`${row.supplierId}-${row.ledgerId}`}
                        className="cashflow-row"
                        onClick={() => onOpenDebt?.(row.supplierId)}
                      >
                        <td>
                          <strong>{row.supplierName}</strong>
                          <div className="panel__meta">
                            {[row.orderNo, row.goodsReceiptId ? `GR #${row.goodsReceiptId}` : null]
                              .filter(Boolean)
                              .join(' · ') || 'Tedarikçi borcu'}
                          </div>
                        </td>
                        <td>{money(row.amount, data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="cashflow-section">
        <h3>Beklenen tahsilat</h3>
        {!data.expectedCollectionsReliable || data.expectedCollections.length === 0 ? (
          <p className="demo-notice">{data.expectedCollectionsNotice}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Müşteri</th>
                  <th>Tutar</th>
                </tr>
              </thead>
              <tbody>
                {data.expectedCollections.map((row) => (
                  <tr
                    key={`${row.customerId}-${row.dueDate}`}
                    className="cashflow-row"
                    onClick={() => onOpenReceivable?.(row.customerId)}
                  >
                    <td>{formatDay(row.dueDate)}</td>
                    <td>{row.customerName}</td>
                    <td>{money(row.amount, data.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}
