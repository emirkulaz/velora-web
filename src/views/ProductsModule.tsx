import { useEffect, useMemo, useState } from 'react'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { apiGet } from '../data/api'
import {
  isTextileCompany,
  type CompanyPresentation,
} from '../data/companyBranding'

interface Product {
  id: number
  code: string
  name: string
  category: string | null
  color: string | null
  widthCm: number | null
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
  costPrice: number | null
  isActive: boolean
  stockQuantity: number
}

function unitLabel(unit: Product['unit']) {
  if (unit === 'METER') return 'Metre'
  if (unit === 'PIECE') return 'Adet'
  return 'Kilogram'
}

export function ProductsModule({
  company,
}: {
  company: CompanyPresentation | null
}) {
  const textile = isTextileCompany(company)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Tümü')
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    apiGet<Product[]>('/products')
      .then(setProducts)
      .catch(() => setError('Ürün verileri alınamadı.'))
      .finally(() => setLoading(false))
  }, [])

  const categories = useMemo(
    () => [
      'Tümü',
      ...new Set(
        products
          .map((product) => product.category)
          .filter((item): item is string => Boolean(item)),
      ),
    ],
    [products],
  )

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchesCat = category === 'Tümü' || p.category === category
        const matchesQuery =
          p.name.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
          p.code.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ||
          (p.category?.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ??
            false) ||
          (textile &&
            (p.color?.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')) ??
              false))
        return matchesCat && matchesQuery
      }),
    [products, search, category, textile],
  )

  const activeCount = products.filter((product) => product.isActive).length
  const criticalCount = products.filter((product) => product.stockQuantity <= 0).length
  const columnCount = textile ? 8 : 6

  return (
    <>
      <ModuleSummary
        items={[
          { label: 'Toplam Ürün', value: loading ? '…' : String(products.length) },
          { label: 'Aktif Ürün', value: loading ? '…' : String(activeCount) },
          { label: 'Kritik Stok', value: loading ? '…' : String(criticalCount) },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Ürün Kataloğu</h2>
          <span className="panel__meta">
            {loading ? 'Yükleniyor…' : `${filtered.length} / ${products.length} ürün`}
          </span>
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={
            textile ? 'Ürün, SKU veya renk ara...' : 'Ürün adı veya SKU ara...'
          }
          filter={category}
          filterOptions={categories.map((item) => ({ value: item, label: item }))}
          onFilterChange={setCategory}
        />
        {error && <p className="demo-notice">{error}</p>}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Ürün Adı</th>
                {textile && <th>Renk</th>}
                {textile && <th>En (cm)</th>}
                <th>Birim</th>
                <th>Maliyet (DZD)</th>
                <th>Stok</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td>{p.name}</td>
                  {textile && <td>{p.color ?? '—'}</td>}
                  {textile && (
                    <td>{p.widthCm != null ? p.widthCm.toLocaleString('tr-TR') : '—'}</td>
                  )}
                  <td>{unitLabel(p.unit)}</td>
                  <td className="amount-cell">
                    {p.costPrice != null ? p.costPrice.toLocaleString('fr-DZ') : '—'}
                  </td>
                  <td>{p.stockQuantity.toLocaleString('tr-TR')}</td>
                  <td>{p.isActive ? 'Aktif' : 'Pasif'}</td>
                </tr>
              ))}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="empty-cell">
                    {products.length === 0
                      ? 'Henüz gerçek ürün kaydı bulunmuyor.'
                      : 'Arama kriterine uyan ürün bulunamadı.'}
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
