import { useEffect, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ReportButton } from '../components/ReportButton'
import { apiGet } from '../data/api'
import type { MenuId } from '../data/types'
import { markOpenCustomerRequestCreate } from './customerRequestActions'
import {
  markOpenFinanceCash,
  markOpenFinanceCollection,
} from './financeActions'
import { markOpenInventoryMovement } from './inventoryActions'
import { markOpenOrderCreate } from './orderActions'
import { useI18n } from '../i18n/I18nProvider'

type PendingDelivery = {
  id: number
  orderNumber: string
  customerName: string | null
  status: string
  remainingQty: number
}

const DAILY_ACTIONS: Array<{
  labelKey: string
  menu: MenuId
  hintKey: string
  open?: () => void
}> = [
  {
    labelKey: 'daily.action.request',
    menu: 'customerRequests',
    hintKey: 'daily.hint.request',
    open: markOpenCustomerRequestCreate,
  },
  {
    labelKey: 'daily.action.order',
    menu: 'orders',
    hintKey: 'daily.hint.order',
    open: markOpenOrderCreate,
  },
  {
    labelKey: 'daily.action.cash',
    menu: 'finance',
    hintKey: 'daily.hint.cash',
    open: markOpenFinanceCash,
  },
  {
    labelKey: 'daily.action.collection',
    menu: 'finance',
    hintKey: 'daily.hint.collection',
    open: markOpenFinanceCollection,
  },
  {
    labelKey: 'daily.action.stock',
    menu: 'inventory',
    hintKey: 'daily.hint.stock',
    open: markOpenInventoryMovement,
  },
]

/** Hızlı işlemler — AI kutusunun üstünde pinlenir. */
export function DailyWorkActions({
  onNavigate,
}: {
  onNavigate?: (menuId: MenuId) => void
}) {
  const { t } = useI18n()
  return (
    <section className="panel panel--full daily-work-actions">
      <div className="panel__header">
        <h2>{t('daily.title')}</h2>
        <ReportButton type="daily-summary" label={t('daily.report')} />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {DAILY_ACTIONS.map((action) => (
          <button
            key={action.labelKey}
            type="button"
            className="btn btn--primary"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 4,
              padding: '14px 16px',
              height: 'auto',
              textAlign: 'left',
            }}
            onClick={() => {
              action.open?.()
              onNavigate?.(action.menu)
            }}
          >
            <span>{t(action.labelKey)}</span>
            <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 400 }}>
              {t(action.hintKey)}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [requests, orders] = await Promise.all([
          apiGet<Array<{ status: string }>>('/customer-requests').catch(
            () => [] as Array<{ status: string }>,
          ),
          apiGet<
            Array<{
              id: number
              orderNumber: string
              customerName: string | null
              status: string
              quantity: number
              deliveredQuantity: number
            }>
          >('/orders').catch(() => []),
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
            .slice(0, 8),
        )
      } catch {
        if (!cancelled) setError(t('daily.loadError'))
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
          { label: t('daily.openRequests'), value: String(openRequests) },
          {
            label: t('daily.pendingDeliveries'),
            value: String(pendingDeliveries.length),
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
        {pendingDeliveries.length === 0 ? (
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
                {pendingDeliveries.map((row) => (
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
