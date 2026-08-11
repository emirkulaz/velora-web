import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icons'
import { StatusBadge } from '../components/StatusBadge'
import { apiGet } from '../data/api'
import { menuItems, type MenuId } from '../data/demoData'
import { canAccessMenu, type AppUserRole } from '../data/roles'
import { useI18n } from '../i18n/I18nProvider'

type SalesOrder = {
  id: number
  orderNumber: string
  customerName: string | null
  orderDate: string
  status: string
  quantity: number
  unit: string
  grossTotal: number
  remainingAmount: number
  currency: string
}

type Customer = { id: number }
type Product = { id: number }

type StockBalance = {
  productId: number
  quantity: number
  valueComputable: boolean
  totalValue: number | null
}

type ProductionOrder = {
  id: number
  orderNumber: string
  productName: string | null
  progress: number
  status: string
  delayed: boolean
  plannedQuantity: number
  completedQuantity: number
  unit: string
  dueDate: string | null
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Taslak',
  CONFIRMED: 'Onaylı',
  IN_PRODUCTION: 'Üretimde',
  READY: 'Hazır',
  PARTIALLY_DELIVERED: 'Kısmi teslim',
  DELIVERED: 'Teslim edildi',
  CANCELLED: 'İptal',
  PLANNED: 'Planlandı',
  IN_PROGRESS: 'Üretimde',
  COMPLETED: 'Tamamlandı',
}

function formatMoney(value: number, currency = 'DZD') {
  return `${value.toLocaleString('fr-DZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} ${currency}`
}

export function OverviewModule({
  role,
  onNavigate,
}: {
  role?: AppUserRole | null
  onNavigate?: (menuId: MenuId) => void
}) {
  const { t } = useI18n()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [balances, setBalances] = useState<StockBalance[]>([])
  const [production, setProduction] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const canReadProduction = role ? canAccessMenu(role, 'production') : false

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      let requestFailed = false
      const [customerRows, productRows, orderRows, stockRows, prodRows] = await Promise.all([
        apiGet<Customer[]>('/customers').catch(() => {
          requestFailed = true
          return [] as Customer[]
        }),
        apiGet<Product[]>('/products').catch(() => {
          requestFailed = true
          return [] as Product[]
        }),
        apiGet<SalesOrder[]>('/orders').catch(() => {
          requestFailed = true
          return [] as SalesOrder[]
        }),
        apiGet<StockBalance[]>('/stock/balances').catch(
          () => {
            requestFailed = true
            return [] as StockBalance[]
          },
        ),
        canReadProduction
          ? apiGet<ProductionOrder[]>('/production-orders').catch(() => {
              requestFailed = true
              return [] as ProductionOrder[]
            })
          : Promise.resolve([] as ProductionOrder[]),
      ])
      if (cancelled) return
      setCustomers(customerRows)
      setProducts(productRows)
      setOrders(orderRows)
      setBalances(stockRows)
      setProduction(prodRows)
      if (requestFailed) {
        setError('Dashboard verilerinin bir bölümü alınamadı. Lütfen sayfayı yenileyin.')
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [canReadProduction])

  const stats = useMemo(() => {
    const stockValue = balances
      .filter((balance) => balance.valueComputable && balance.totalValue != null)
      .reduce((sum, balance) => sum + Number(balance.totalValue), 0)
    const productionInProgress = production.filter(
      (order) => order.status === 'IN_PROGRESS',
    ).length

    return [
      {
        label: 'Müşteri Sayısı',
        value: loading ? '…' : String(customers.length),
      },
      {
        label: 'Ürün Sayısı',
        value: loading ? '…' : String(products.length),
      },
      {
        label: 'Sipariş Sayısı',
        value: loading ? '…' : String(orders.length),
      },
      {
        label: 'Stok Değeri',
        value: loading ? '…' : formatMoney(stockValue).replace(' DZD', ''),
        unit: 'DZD',
      },
      {
        label: 'Üretimdeki Emir',
        value: loading ? '…' : String(productionInProgress),
      },
    ]
  }, [customers, products, orders, balances, production, loading])

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => b.orderDate.localeCompare(a.orderDate) || b.id - a.id)
        .slice(0, 8),
    [orders],
  )

  const activeLines = useMemo(
    () =>
      production
        .filter((p) => p.status === 'PLANNED' || p.status === 'IN_PROGRESS')
        .slice(0, 6),
    [production],
  )

  return (
    <>
      {error && (
        <p className="demo-notice" role="alert">
          {error}
        </p>
      )}

      <section className="panel panel--full overview-shortcuts">
        <div className="panel__header">
          <h2>{t('overview.shortcuts')}</h2>
          <span className="panel__meta">{t('overview.shortcutsHint')}</span>
        </div>
        <div className="overview-shortcuts__grid">
          {menuItems
            .filter((item) => item.id !== 'overview' && canAccessMenu(role, item.id))
            .map((item) => (
              <button
                key={item.id}
                type="button"
                className="overview-shortcuts__item"
                onClick={() => onNavigate?.(item.id)}
              >
                <span className="overview-shortcuts__icon">
                  <Icon name={item.icon} />
                </span>
                <span className="overview-shortcuts__title">{t(`nav.${item.id}`)}</span>
                <span className="overview-shortcuts__case">
                  {t(`overview.case.${item.id}`)}
                </span>
              </button>
            ))}
        </div>
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Son Siparişler</h2>
          <span className="panel__meta">
            {loading ? 'Yükleniyor…' : `${recentOrders.length} kayıt`}
          </span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Müşteri</th>
                <th>Miktar</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    Henüz sipariş kaydı yok.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono">{order.orderNumber}</td>
                    <td>{order.customerName ?? '—'}</td>
                    <td>
                      {order.quantity.toLocaleString('tr-TR')} {order.unit}
                    </td>
                    <td className="amount-cell">
                      {formatMoney(order.grossTotal, order.currency)}
                    </td>
                    <td>
                      <StatusBadge
                        status={STATUS_LABELS[order.status] ?? order.status}
                      />
                    </td>
                    <td className="date-cell">
                      {order.orderDate.split('-').reverse().join('.')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Üretim Durumu</h2>
          <span className="panel__meta">
            {loading
              ? 'Yükleniyor…'
              : activeLines.length === 0
                ? 'Aktif emir yok'
                : `${activeLines.length} aktif emir`}
          </span>
        </div>
        {activeLines.length === 0 ? (
          <p className="empty-state">
            Aktif üretim emri yok. Üretim menüsünden emir oluşturabilirsiniz.
          </p>
        ) : (
          <div className="production-grid">
            {activeLines.map((line) => (
              <article key={line.id} className="production-card">
                <div className="production-item__header">
                  <span className="production-item__name">
                    {line.orderNumber} · {line.productName ?? 'Ürün'}
                  </span>
                  <StatusBadge
                    status={
                      line.delayed
                        ? 'Gecikmiş'
                        : STATUS_LABELS[line.status] ?? line.status
                    }
                  />
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{ width: `${line.progress}%` }}
                  />
                </div>
                <div className="production-item__footer">
                  <span>{line.progress}% tamamlandı</span>
                  <span>
                    {line.completedQuantity.toLocaleString('tr-TR')} /{' '}
                    {line.plannedQuantity.toLocaleString('tr-TR')} {line.unit}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <div className="stat-card__value">
              {stat.value}
              {stat.unit ? (
                <span className="stat-card__unit">{stat.unit}</span>
              ) : null}
            </div>
            <span className="stat-card__label">{stat.label}</span>
          </article>
        ))}
      </section>
    </>
  )
}
