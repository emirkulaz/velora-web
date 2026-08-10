import { useEffect, useMemo, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiGet } from '../data/api'
import {
  isTextileCompany,
  type CompanyPresentation,
} from '../data/companyBranding'

interface StockBalance {
  productId: number
  code: string
  name: string
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
  color: string | null
  widthCm: number | null
  costPrice: number | null
  unitCost: number | null
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  totalValue: number | null
  valueComputable: boolean
  valueNote: string | null
  source: string
  packageCount: number
  warehouses: Array<{ code: string; name: string; quantity: number; packageCount: number }>
}

function unitLabel(unit: StockBalance['unit']) {
  if (unit === 'METER') return 'Metre'
  if (unit === 'PIECE') return 'Adet'
  return 'Kilogram'
}

function formatQty(value: number) {
  return value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })
}

function formatMoney(value: number) {
  return value.toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function InventoryModule({
  company,
}: {
  company: CompanyPresentation | null
}) {
  const textile = isTextileCompany(company)
  const [search, setSearch] = useState('')
  const [balances, setBalances] = useState<StockBalance[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiGet<StockBalance[]>('/stock/balances')
      .then(setBalances)
      .catch(() => setError('Stok verileri alınamadı.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase('tr-TR')
    return balances.filter((item) =>
      [
        item.name,
        item.code,
        item.color ?? '',
        ...item.warehouses.map((warehouse) => warehouse.name),
      ].some((value) => value.toLocaleLowerCase('tr-TR').includes(query)),
    )
  }, [balances, search])

  const totalMeters = balances
    .filter((item) => item.unit === 'METER')
    .reduce((sum, item) => sum + item.quantity, 0)
  const totalPieces = balances
    .filter((item) => item.unit === 'PIECE')
    .reduce((sum, item) => sum + item.quantity, 0)
  const totalKilograms = balances
    .filter((item) => item.unit === 'KILOGRAM')
    .reduce((sum, item) => sum + item.quantity, 0)
  const criticalCount = balances.filter((item) => item.quantity <= 0).length
  const valued = balances.filter((item) => item.valueComputable && item.totalValue != null)
  const totalStockValue = valued.reduce((sum, item) => sum + (item.totalValue ?? 0), 0)
  const missingCostCount = balances.length - valued.length

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Toplam Metre', value: loading ? '…' : formatQty(totalMeters), unit: 'm' },
          { label: 'Toplam Adet', value: loading ? '…' : formatQty(totalPieces) },
          { label: 'Toplam Kilogram', value: loading ? '…' : formatQty(totalKilograms), unit: 'kg' },
          { label: 'Kritik Stok', value: loading ? '…' : String(criticalCount) },
          {
            label: 'Toplam Stok Değeri',
            value: loading
              ? '…'
              : missingCostCount === balances.length && balances.length > 0
                ? 'Hesaplanamıyor'
                : formatMoney(totalStockValue),
            unit:
              missingCostCount === balances.length && balances.length > 0 ? undefined : 'DZD',
          },
        ]}
      />

      {missingCostCount > 0 && balances.length > 0 && (
        <p className="demo-notice">
          Stok değeri hesaplanamıyor: maliyet fiyatı eksik ({missingCostCount} kalem). Satış
          fiyatı kullanılmaz.
        </p>
      )}

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Stok Durumu</h2>
          <span className="panel__meta">
            {loading ? 'Yükleniyor…' : `${filtered.length} kalem`}
          </span>
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ürün, SKU, renk veya depo ara..."
        />
        {error && <p className="demo-notice">{error}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ürün</th>
                {textile && <th>Renk</th>}
                {textile && <th>Ölçü / En</th>}
                <th>Birim</th>
                <th>Mevcut</th>
                <th>Rezerve</th>
                <th>Kullanılabilir</th>
                <th>Birim Maliyet</th>
                <th>Toplam Değer</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr key={item.productId}>
                  <td>
                    <div>{item.name}</div>
                    <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                      {item.code}
                    </div>
                  </td>
                  {textile && <td>{item.color ?? '—'}</td>}
                  {textile && (
                    <td>
                      {item.widthCm != null ? `${item.widthCm.toLocaleString('tr-TR')} cm` : '—'}
                    </td>
                  )}
                  <td>{unitLabel(item.unit)}</td>
                  <td>{formatQty(item.quantity)}</td>
                  <td>{formatQty(item.reservedQuantity)}</td>
                  <td>{formatQty(item.availableQuantity)}</td>
                  <td className="amount-cell">
                    {item.unitCost != null ? formatMoney(item.unitCost) : '—'}
                  </td>
                  <td className="amount-cell">
                    {item.valueComputable && item.totalValue != null
                      ? formatMoney(item.totalValue)
                      : item.valueNote ?? '—'}
                  </td>
                </tr>
              ))}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={textile ? 9 : 7} className="empty-cell">
                    Henüz gerçek stok hareketi bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
