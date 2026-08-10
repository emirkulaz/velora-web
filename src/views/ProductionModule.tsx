import { useMemo, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { StatusBadge } from '../components/StatusBadge'
import { matchesSearch, productionOrders } from '../data/demoData'

export function ProductionModule() {
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () => productionOrders.filter((o) => matchesSearch(o.product, search) || matchesSearch(o.id, search)),
    [search],
  )

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Aktif Emir', value: String(productionOrders.filter((o) => o.status !== 'Tamamlandı').length) },
          { label: 'Geciken', value: String(productionOrders.filter((o) => o.delayed).length) },
          { label: 'Tamamlanan', value: String(productionOrders.filter((o) => o.status === 'Tamamlandı').length) },
          { label: 'Ort. İlerleme', value: '0', unit: '%' },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Aktif Üretim Emirleri</h2>
          <span className="panel__meta">Africa/Algiers</span>
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Emir no veya ürün ara..."
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Emir No</th>
                <th>Ürün</th>
                <th>Planlanan</th>
                <th>Tamamlanan</th>
                <th>İlerleme</th>
                <th>Durum</th>
                <th>Termin</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Henüz üretim emri yok.
                  </td>
                </tr>
              ) : (
                filtered.map((order) => (
                  <tr key={order.id} className={order.delayed ? 'row--delayed' : ''}>
                    <td className="mono">{order.id}</td>
                    <td>{order.product}</td>
                    <td>
                      {order.planned} {order.unit}
                    </td>
                    <td>
                      {order.completed} {order.unit}
                    </td>
                    <td>
                      <div className="table-progress">
                        <div className="progress-bar">
                          <div className="progress-bar__fill" style={{ width: `${order.progress}%` }} />
                        </div>
                        <span>{order.progress}%</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={order.delayed ? 'Gecikmiş' : order.status} />
                    </td>
                    <td className="date-cell">{order.dueDate}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
