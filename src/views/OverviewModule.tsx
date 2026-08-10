import { StatIcon } from '../components/Icons'
import { StatusBadge } from '../components/StatusBadge'
import { productionLines, recentOrders, stats } from '../data/demoData'

export function OverviewModule() {
  return (
    <>
      <section className="stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <div className="stat-card__top">
              <span className="stat-card__icon">
                <StatIcon name={stat.icon} />
              </span>
              <span className={`stat-card__change stat-card__change--${stat.trend}`}>
                {stat.change}
              </span>
            </div>
            <div className="stat-card__value">
              {stat.value}
              <span className="stat-card__unit">{stat.unit}</span>
            </div>
            <span className="stat-card__label">{stat.label}</span>
          </article>
        ))}
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Son Siparişler</h2>
          <span className="panel__meta">{recentOrders.length} kayıt</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Müşteri</th>
                <th>Ürün</th>
                <th>Miktar</th>
                <th>Tutar (DZD)</th>
                <th>Durum</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Henüz sipariş kaydı yok.
                  </td>
                </tr>
              ) : (
                recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono">{order.id}</td>
                    <td>{order.customer}</td>
                    <td>{order.product}</td>
                    <td>{order.quantity}</td>
                    <td className="amount-cell">{order.amount}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="date-cell">{order.date}</td>
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
            {productionLines.length === 0
              ? 'Henüz hat tanımı yok'
              : `${productionLines.length} hat · ${productionLines.filter((line) => line.status === 'Aktif').length} aktif`}
          </span>
        </div>
        {productionLines.length === 0 ? (
          <p className="empty-state">Üretim hatları henüz tanımlanmadı.</p>
        ) : (
          <div className="production-grid">
            {productionLines.map((line) => (
              <article key={line.name} className="production-card">
                <div className="production-item__header">
                  <span className="production-item__name">{line.name}</span>
                  <StatusBadge status={line.status} />
                </div>
                <div className="progress-bar">
                  <div className="progress-bar__fill" style={{ width: `${line.progress}%` }} />
                </div>
                <div className="production-item__footer">
                  <span>{line.progress}% kapasite</span>
                  <span>{line.output}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
