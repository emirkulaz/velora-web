import { useEffect, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ReportButton } from '../components/ReportButton'
import { apiGet } from '../data/api'
import type { MenuId } from '../data/types'
import { markOpenCustomerRequestCreate } from './CustomerRequestsModule'
import {
  markOpenFinanceCash,
  markOpenFinanceCollection,
} from './FinanceModule'
import { markOpenInventoryMovement } from './InventoryModule'
import { markOpenOrderCreate } from './OrdersModule'

type PendingDelivery = {
  id: number
  orderNumber: string
  customerName: string | null
  status: string
  remainingQty: number
}

const DAILY_ACTIONS: Array<{
  label: string
  menu: MenuId
  hint: string
  open?: () => void
}> = [
  {
    label: 'Yeni müşteri talebi',
    menu: 'customerRequests',
    hint: 'Görüşme / talep kaydı',
    open: markOpenCustomerRequestCreate,
  },
  {
    label: 'Yeni sipariş',
    menu: 'orders',
    hint: 'Sipariş oluştur',
    open: markOpenOrderCreate,
  },
  {
    label: 'Kasa hareketi',
    menu: 'finance',
    hint: 'Günlük kasa',
    open: markOpenFinanceCash,
  },
  {
    label: 'Tahsilat',
    menu: 'finance',
    hint: 'Müşteri tahsilatı',
    open: markOpenFinanceCollection,
  },
  {
    label: 'Stok hareketi',
    menu: 'inventory',
    hint: 'Stok girişi/çıkışı',
    open: markOpenInventoryMovement,
  },
]

/** Hızlı işlemler — AI kutusunun üstünde pinlenir. */
export function DailyWorkActions({
  onNavigate,
}: {
  onNavigate?: (menuId: MenuId) => void
}) {
  return (
    <section className="panel panel--full daily-work-actions">
      <div className="panel__header">
        <h2>Günlük İşler</h2>
        <ReportButton type="daily-summary" label="Günlük Genel Rapor" />
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
            key={action.label}
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
            <span>{action.label}</span>
            <span style={{ fontSize: 12, opacity: 0.85, fontWeight: 400 }}>
              {action.hint}
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
        if (!cancelled) setError('Günlük özet yüklenemedi.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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
          { label: 'Açık talepler', value: String(openRequests) },
          {
            label: 'Bekleyen teslimat',
            value: String(pendingDeliveries.length),
          },
          { label: 'Kontrol bekleyen bordro', value: '—' },
          { label: 'Bekleyen vergi/gider', value: '—' },
        ]}
      />

      <section className="panel panel--full" style={{ marginTop: 16 }}>
        <div className="panel__header">
          <h2>Bekleyen teslimatlar</h2>
          <ReportButton type="deliveries" label="Teslimat Raporu" />
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onNavigate?.('orders')}
          >
            Siparişlere git
          </button>
        </div>
        {pendingDeliveries.length === 0 ? (
          <p className="empty-state">Bekleyen teslimat yok veya sipariş API’si henüz uygulanmadı.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sipariş</th>
                  <th>Müşteri</th>
                  <th>Durum</th>
                  <th>Kalan miktar</th>
                </tr>
              </thead>
              <tbody>
                {pendingDeliveries.map((row) => (
                  <tr key={row.id}>
                    <td>{row.orderNumber}</td>
                    <td>{row.customerName ?? '—'}</td>
                    <td>{row.status}</td>
                    <td>{row.remainingQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel panel--full" style={{ marginTop: 16 }}>
        <div className="panel__header">
          <h2>Kontrol bekleyen bordrolar</h2>
        </div>
        <p className="empty-state">
          Bordro modülü henüz bağlanmadı. Sahte kayıt gösterilmez.
        </p>
      </section>

      <section className="panel panel--full" style={{ marginTop: 16 }}>
        <div className="panel__header">
          <h2>Yaklaşan / bekleyen vergi giderleri</h2>
          <ReportButton type="expenses" label="Gider Raporu" />
        </div>
        <p className="empty-state">
          Vergi ve gider modülü henüz bağlanmadı. Sahte kayıt gösterilmez.
        </p>
      </section>
    </>
  )
}
