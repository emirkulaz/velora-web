import { useEffect, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ReportButton } from '../components/ReportButton'
import { apiGet } from '../data/api'
import type { MenuId } from '../data/types'
import { useI18n } from '../i18n/I18nProvider'
import { DailyWorkActions } from './DailyWorkActions'

type PendingDelivery = {
  id: number
  orderNumber: string
  customerName: string | null
  status: string
  remainingQty: number
}

/**
 * ACCOUNTING_OPERATIONS (ve eşdeğer) kullanıcılar için yeniden kullanılabilir günlük iş merkezi.
 * Kişiye özel değil; backend yetkisi olmadan işlem yapılamaz.
 */
export function DailyWorkModule({
  onNavigate,
  showActions = true,
}: {
  onNavigate?: (menuId: MenuId) => void
  showActions?: boolean
}) {
  const { t, formatNumber } = useI18n()
  const [openRequests, setOpenRequests] = useState(0)
  const [pendingDeliveries, setPendingDeliveries] = useState<PendingDelivery[]>(
    [],
  )
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const [requests, orders] = await Promise.all([
          apiGet<Array<{ status: string }>>('/customer-requests'),
          apiGet<
            Array<{
              id: number
              orderNumber: string
              customerName: string | null
              status: string
              quantity: number
              deliveredQuantity: number
            }>
          >('/orders'),
        ])
        if (cancelled) return
        setOpenRequests(
          requests.filter(
            (r) =>
              r.status === 'NEW' ||
              r.status === 'REVIEWING' ||
              r.status === 'QUOTED',
          ).length,
        )
        setPendingDeliveries(
          orders
            .filter(
              (o) =>
                o.status === 'READY' ||
                o.status === 'PARTIALLY_DELIVERED' ||
                o.status === 'CONFIRMED' ||
                o.status === 'IN_PRODUCTION',
            )
            .map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              customerName: o.customerName,
              status: o.status,
              remainingQty: Math.max(
                0,
                Number(o.quantity) - Number(o.deliveredQuantity ?? 0),
              ),
            }))
            .filter((order) => order.remainingQty > 0),
        )
      } catch {
        if (!cancelled) setError(t('daily.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <>
      {showActions ? <DailyWorkActions onNavigate={onNavigate} /> : null}
      {error && (
        <p className="demo-notice" role="alert">
          {error}
        </p>
      )}

      <ModuleSummary
        items={[
          { label: t('daily.openRequests'), value: loading ? '…' : error ? '—' : String(openRequests) },
          {
            label: t('daily.pendingDeliveries'),
            value: loading ? '…' : error ? '—' : String(pendingDeliveries.length),
          },
          { label: t('daily.payrollReview'), value: '—' },
          { label: t('daily.pendingExpense'), value: '—' },
        ]}
      />

      <section className="panel panel--full" style={{ marginTop: 16 }}>
        <div className="panel__header">
          <h2>{t('daily.deliveriesTitle')}</h2>
          <ReportButton type="deliveries" label={t('daily.deliveryReport')} />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onNavigate?.('orders')}
          >
            {t('daily.goOrders')}
          </button>
        </div>
        {loading ? (
          <p role="status">{t('common.loading')}</p>
        ) : error ? null : pendingDeliveries.length === 0 ? (
          <p className="empty-state">{t('daily.noDeliveries')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('daily.order')}</th>
                  <th>{t('daily.customer')}</th>
                  <th>{t('daily.status')}</th>
                  <th>{t('daily.remaining')}</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeliveries.slice(0, 8).map((row) => (
                  <tr key={row.id}>
                    <td>{row.orderNumber}</td>
                    <td>{row.customerName ?? '—'}</td>
                    <td>{t(`orders.status.${row.status}`)}</td>
                    <td>{formatNumber(row.remainingQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel panel--full" style={{ marginTop: 16 }}>
        <div className="panel__header">
          <h2>{t('daily.payrollTitle')}</h2>
        </div>
        <p className="empty-state">
          {t('daily.payrollUnavailable')}
        </p>
      </section>

      <section className="panel panel--full" style={{ marginTop: 16 }}>
        <div className="panel__header">
          <h2>{t('daily.expenseTitle')}</h2>
          <ReportButton type="expenses" label={t('daily.expenseReport')} />
        </div>
        <p className="empty-state">
          {t('daily.expenseUnavailable')}
        </p>
      </section>
    </>
  )
}
