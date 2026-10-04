import { useEffect, useState } from 'react'
import { apiGet } from '../data/api'
import { algiersYmd } from '../data/dates'
import type { MenuId } from '../data/types'
import { useI18n } from '../i18n/I18nProvider'
import { StatusBadge } from '../components/StatusBadge'

type OrderSummaryRow = {
  lineDescription?: string; sourceDescription?: string | null; id: number; orderNumber: string; customerName: string | null; productName: string | null
  quantity: number; unit: 'PIECE' | 'METER' | 'KILOGRAM'; unitPrice: number; grossTotal: number
  currency: string; status: string; orderDate: string; expectedDeliveryDate: string | null
  deliveredQuantity?: number; notes: string | null
}
type Filter = 'pending' | 'today' | 'all'
const isPending = (order: OrderSummaryRow) => order.status !== 'CANCELLED' && order.status !== 'DELIVERED' && (order.deliveredQuantity ?? 0) < order.quantity
const isOverdue = (order: OrderSummaryRow, today: string) => isPending(order) && order.status !== 'DRAFT' && Boolean(order.expectedDeliveryDate && order.expectedDeliveryDate.slice(0, 10) < today)

export function OrderOverview({ onNavigate }: { onNavigate?: (id: MenuId) => void }) {
  const { t, formatCurrency, formatNumber, formatDate, locale } = useI18n()
  const [orders, setOrders] = useState<OrderSummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  const [filter, setFilter] = useState<Filter>('pending')
  const [query, setQuery] = useState('')
  const today = algiersYmd()
  useEffect(() => {
    let live = true
    apiGet<OrderSummaryRow[]>('/orders').then((rows) => {
      if (live) { setOrders(rows); setFailed(false) }
    }).catch(() => { if (live) setFailed(true) }).finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [revision])
  const refresh = () => { setLoading(true); setRevision((value) => value + 1) }
  const pending = orders.filter(isPending)
  const overdue = pending.filter((order) => isOverdue(order, today))
  const totals = pending.reduce<Record<string, number>>((result, order) => {
    result[order.currency] = (result[order.currency] ?? 0) + order.grossTotal
    return result
  }, {})
  const visible = (() => {
    const search = query.trim().toLocaleLowerCase(locale)
    return orders.filter((order) => {
      const matchesFilter = filter === 'pending' ? isPending(order) : filter === 'today' ? order.status !== 'CANCELLED' && order.orderDate.slice(0, 10) === today : true
      return matchesFilter && [order.orderNumber, order.customerName, order.productName, order.notes].some((value) => value?.toLocaleLowerCase(locale).includes(search))
    }).sort((a, b) => Number(isOverdue(b, today)) - Number(isOverdue(a, today)) || b.orderDate.localeCompare(a.orderDate) || b.id - a.id)
  })()
  return <section className="order-overview" aria-label={t('orderOverview.title')} aria-busy={loading}>
    <header className="order-overview__heading">
      <div><span className="executive-eyebrow">{formatDate(`${today}T12:00:00`)}</span><h1>{t('orderOverview.title')}</h1><p>{t('orderOverview.subtitle')}</p></div>
      <div className="order-overview__actions"><button className="btn btn--ghost" type="button" disabled={loading} onClick={refresh}>{t('orderOverview.refresh')}</button>{onNavigate && <button type="button" className="btn btn--primary" onClick={() => onNavigate('orders')}>{t('orderOverview.manage')}</button>}</div>
    </header>
    {failed ? <div className="demo-notice" role="alert">{t('orders.loadError')}</div> : loading ? <p role="status">{t('common.loading')}</p> : <>
      <div className="order-overview__metrics order-overview__metrics--single">
        <article><span>{t('orderOverview.total')}</span>{Object.entries(totals).length ? Object.entries(totals).map(([currency, total]) => <strong key={currency}>{formatCurrency(total, currency)}</strong>) : <strong>—</strong>}</article>
      </div>
      {overdue.length > 0 && <p className="order-overview__warning" role="status">{t('orderOverview.overdueNotice', { count: overdue.length })}</p>}
      <div className="order-overview__filters">
        <div className="order-overview__tabs">{(['pending', 'today', 'all'] as const).map((value) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{t(`orderOverview.filter.${value}`)}</button>)}</div>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('orderOverview.search')} aria-label={t('orderOverview.search')} />
      </div>
      <div className="order-overview__cards">
        {visible.map((order) => {
          const remaining = Math.max(0, order.quantity - (order.deliveredQuantity ?? 0))
          const pendingDelivery = isPending(order)
          return <article key={order.id} className={`order-overview__card ${isOverdue(order, today) ? 'order-overview__card--overdue' : ''}`}>
            <header><div><span>{order.orderNumber}</span><h2 dir="auto">{order.lineDescription || order.productName || t('orders.noLinkedProduct')}</h2><p dir="auto">{order.customerName || '—'}</p></div><StatusBadge status={t(`orders.status.${order.status}`)} /></header>
            <p className="order-overview__calculation"><strong>{formatNumber(order.quantity)} {t(`orderOverview.unit.${order.unit}`)}</strong><span>× {formatCurrency(order.unitPrice, order.currency)}</span></p>
            <div className="order-overview__total"><span>{t('orders.total')}</span><strong>{formatCurrency(order.grossTotal, order.currency)}</strong></div>
            <dl><div><dt>{t('orders.orderDate')}</dt><dd>{formatDate(order.orderDate)}</dd></div><div><dt>{t('orders.expectedDelivery')}</dt><dd>{order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : t('orderOverview.noDate')}</dd></div></dl>
            {pendingDelivery && <p className={`order-overview__delivery ${isOverdue(order, today) ? 'is-critical' : ''}`}>
              {order.status === 'DRAFT' ? t('orderOverview.draftNotice') : isOverdue(order, today) ? t('orderOverview.lateDelivery') : (order.deliveredQuantity ?? 0) > 0 ? t('orderOverview.partialDelivery') : t('orderOverview.notDelivered')}
              <span>{t('orderOverview.remaining', { quantity: formatNumber(remaining), unit: t(`orderOverview.unit.${order.unit}`) })}</span>
            </p>}
            {order.notes && <p className="order-overview__note" dir="auto">{order.notes}</p>}
          </article>
        })}
      </div>
      {!visible.length && <p className="empty-state">{t('orderOverview.empty')}</p>}
    </>}
  </section>
}
