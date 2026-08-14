import { useEffect, useMemo, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ApiError, apiGet } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

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

function CashFlowChart({
  data,
  currency,
  label,
}: {
  data: CashFlowSnapshot['flow']
  currency: string
  label: string
}) {
  const w = 720
  const h = 240
  const p = 32
  const max = Math.max(...data.flatMap((d) => [d.inflow, d.outflow, Math.abs(d.net)]), 1)
  const group = (w - p * 2) / Math.max(data.length, 1)
  const bar = Math.max(2, group * 0.28)
  const ticks = data.filter((_, i) => i === 0 || i === data.length - 1 || i % 7 === 0)
  return (
    <svg className="executive-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
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
  const { t, formatCurrency, formatDate } = useI18n()
  const money = (value: number, currency: string) => formatCurrency(value, currency)
  const formatDay = (ymd: string) => formatDate(`${ymd}T12:00:00`, { day: 'numeric', month: 'long' })
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
        if (live) setError(err instanceof ApiError ? err.message : t('cashflow.loadError'))
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [t])

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

  if (loading) return <p className="demo-notice">{t('cashflow.loading')}</p>
  if (error || !data) return <p className="demo-notice" role="alert">{error || t('cashflow.noData')}</p>

  const k = data.kpis

  return (
    <section className="panel panel--full cashflow-panel">
      <div className="panel__header">
        <h2>{t('cashflow.title')}</h2>
        <p className="panel__meta">{t('cashflow.subtitle')}</p>
      </div>

      <ModuleSummary
        items={[
          { label: t('cashflow.currentCash'), value: money(k.currentCash, data.currency) },
          { label: t('cashflow.collections30d'), value: money(k.collections30d, data.currency) },
          { label: t('cashflow.outflow30d'), value: money(k.outflow30d, data.currency) },
          { label: t('cashflow.upcoming7d'), value: money(k.upcomingPayments7d, data.currency) },
          { label: t('cashflow.overdueDebt'), value: money(k.overdueDebt, data.currency) },
          { label: t('cashflow.netChange'), value: money(k.netCashChange30d, data.currency) },
        ]}
      />

      <article className={`cashflow-liquidity cashflow-liquidity--${k.liquidity}`}>
        <div>
          <span>{t('cashflow.forecast')}</span>
          <strong>{money(k.projectedCash7d, data.currency)}</strong>
          <small>
            {k.expectedCollections7d != null
              ? t('cashflow.forecastWithCollection', { cash: money(k.currentCash, data.currency), payments: money(k.upcomingPayments7d, data.currency), collections: money(k.expectedCollections7d, data.currency) })
              : t('cashflow.forecastWithoutCollection', { cash: money(k.currentCash, data.currency), payments: money(k.upcomingPayments7d, data.currency) })}
          </small>
        </div>
        <b>{t(`cashflow.risk.${k.liquidity}`)}</b>
      </article>

      <section className="cashflow-section">
        <header>
          <h3>{t('cashflow.actual30d')}</h3>
          <div className="chart-legend">
            <i className="legend-income" /> {t('cashflow.inflow')}
            <i className="legend-expense" /> {t('cashflow.outflow')}
            <span className="cashflow-net-legend">{t('cashflow.net')}</span>
          </div>
        </header>
        <CashFlowChart data={data.flow} currency={data.currency} label={t('cashflow.chartLabel')} />
      </section>

      <section className="cashflow-section">
        <h3>{t('cashflow.calendar7d')}</h3>
        {groupedCalendar.length === 0 ? (
          <p className="empty-state">{t('cashflow.noUpcoming')}</p>
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
                              .join(' · ') || t('cashflow.supplierDebt')}
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
        <h3>{t('cashflow.expected')}</h3>
        {!data.expectedCollectionsReliable || data.expectedCollections.length === 0 ? (
          <p className="demo-notice">{t('cashflow.noticeUnavailable')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('cashflow.date')}</th>
                  <th>{t('cashflow.customer')}</th>
                  <th>{t('cashflow.amount')}</th>
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
