import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../data/api'
import {
  isTextileCompany,
  type CompanyPresentation,
} from '../data/companyBranding'
import { resolveTextileColors } from '../data/textileColors'

interface Product {
  id: number
  code: string
  name: string
  category: string | null
  color: string | null
  widthCm: number | null
  unit: 'METER' | 'PIECE'
  productType: 'COLLAR' | 'BAND' | null
  yarnType: string | null
  weightGramPerSaleUnit: number | null
  yarnPricePerKg: number | null
  costPrice: number | null
  salePrice: number | null
  isActive: boolean
  stockQuantity: number
}

type ProductUnit = Product['unit']

type ProductForm = {
  code: string
  name: string
  unit: ProductUnit
  productType: '' | 'COLLAR' | 'BAND'
  yarnType: string
  color: string
  widthCm: string
  salePrice: string
  costPrice: string
  weightGramPerSaleUnit: string
  yarnPricePerKg: string
  isActive: boolean
}

const EMPTY_FORM: ProductForm = {
  code: '',
  name: '',
  unit: 'PIECE',
  productType: '',
  yarnType: '',
  color: '',
  widthCm: '',
  salePrice: '',
  costPrice: '',
  weightGramPerSaleUnit: '',
  yarnPricePerKg: '',
  isActive: true,
}

function unitLabel(unit: ProductUnit) {
  if (unit === 'METER') return 'Metre'
  if (unit === 'PIECE') return 'Adet'
  return 'Adet'
}

function stripeBackground(colors: { hex: string }[]): string {
  if (colors.length === 1) return colors[0]!.hex
  const stops = colors.flatMap((c, i) => {
    const start = (i / colors.length) * 100
    const end = ((i + 1) / colors.length) * 100
    return [`${c.hex} ${start}%`, `${c.hex} ${end}%`]
  })
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

function ColorCell({ product }: { product: Product }) {
  let colors: ReturnType<typeof resolveTextileColors> = []
  try {
    colors = resolveTextileColors(product.color, product.name)
  } catch {
    colors = []
  }
  if (colors.length === 0) return '—'
  const label = colors.map((c) => c.label).join(' / ')
  return (
    <span className="color-swatch" title={label}>
      <span
        className="color-swatch__stripe"
        style={{ background: stripeBackground(colors) }}
        aria-hidden
      />
      <span className="color-swatch__label">{label}</span>
    </span>
  )
}

export function ProductsModule({
  company,
  canWrite = false,
  canDelete = false,
}: {
  company: CompanyPresentation | null
  canWrite?: boolean
  canDelete?: boolean
}) {
  const textile = isTextileCompany(company)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Tümü')
  const [products, setProducts] = useState<Product[]>([])
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [editing, setEditing] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [successNotice, setSuccessNotice] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const rows = await apiGet<Product[]>('/products')
      setProducts(rows)
      setError('')
    } catch {
      setError('Ürün verileri alınamadı.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
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

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)
    setForm({
      code: product.code,
      name: product.name,
      unit: product.unit,
      productType: product.productType ?? (product.unit === 'METER' ? 'BAND' : 'COLLAR'),
      yarnType: product.yarnType ?? '',
      color: product.color ?? '',
      widthCm: product.widthCm?.toString() ?? '',
      salePrice: product.salePrice?.toString() ?? '',
      costPrice: product.costPrice?.toString() ?? '',
      weightGramPerSaleUnit: product.weightGramPerSaleUnit?.toString() ?? '',
      yarnPricePerKg: product.yarnPricePerKg?.toString() ?? '',
      isActive: product.isActive,
    })
    setFormError('')
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!form.code.trim() || !form.name.trim() || !form.productType || !form.yarnType.trim() || !Number(form.weightGramPerSaleUnit)) {
      setFormError('Kod, ürün adı, ürün türü, iplik türü ve gramaj zorunludur.')
      return
    }
    setSaving(true)
    setFormError('')
    setError('')
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        unit: form.unit,
        productType: form.productType,
        yarnType: form.yarnType.trim(),
        category: form.productType === 'COLLAR' ? 'Yaka' : 'Bant',
        color: form.color.trim() || (editing ? null : undefined),
        widthCm: form.widthCm ? Number(form.widthCm) : editing ? null : undefined,
        salePrice: form.salePrice ? Number(form.salePrice) : editing ? null : undefined,
        costPrice: form.costPrice ? Number(form.costPrice) : editing ? null : undefined,
        weightGramPerSaleUnit: Number(form.weightGramPerSaleUnit),
        yarnPricePerKg: form.yarnPricePerKg ? Number(form.yarnPricePerKg) : editing ? null : undefined,
        isActive: form.isActive,
      }
      if (editing) {
        await apiPatch(`/products/${editing.id}`, payload)
      } else {
        await apiPost('/products', payload)
      }
      setFormOpen(false)
      setForm(EMPTY_FORM)
      await load()
      setSuccessNotice(editing ? 'Ürün güncellendi.' : 'Yeni ürün kaydedildi.')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Ürün kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canDelete || saving) return
    setSaving(true)
    setError('')
    try {
      await apiDelete(`/products/${deleteTarget.id}`)
      setDeleteTarget(null)
      await load()
      setSuccessNotice('Ürün silindi.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ürün silinemedi.')
    } finally {
      setSaving(false)
    }
  }

  const activeCount = products.filter((product) => product.isActive).length
  const criticalCount = products.filter((product) => product.stockQuantity <= 0).length
  const columnCount = (textile ? 10 : 7) + (canWrite || canDelete ? 1 : 0)

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
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
          {canWrite ? (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              + Yeni Ürün
            </button>
          ) : (
            <span className="panel__meta">
              {loading ? 'Yükleniyor…' : `${filtered.length} / ${products.length} ürün`}
            </span>
          )}
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
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Ürün Adı</th>
                {textile && <th>Renk</th>}
                {textile && <th>Ürün Türü</th>}
                <th>Birim</th>
                {textile && <th>Gramaj</th>}
                <th>Satış (DZD)</th>
                <th>Stok</th>
                <th>Durum</th>
                {(canWrite || canDelete) && <th>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.code}</td>
                  <td>{p.name}</td>
                  {textile && (
                    <td>
                      <ColorCell product={p} />
                    </td>
                  )}
                  {textile && <td>{p.productType === 'COLLAR' ? 'Yaka' : p.productType === 'BAND' ? 'Bant' : '—'}</td>}
                  <td>{unitLabel(p.unit)}</td>
                  {textile && <td>{p.weightGramPerSaleUnit != null ? `${p.weightGramPerSaleUnit.toLocaleString('tr-TR')} g/${p.unit === 'PIECE' ? 'adet' : 'metre'}` : '—'}</td>}
                  <td className="amount-cell">
                    {p.salePrice != null ? `${p.salePrice.toLocaleString('fr-DZ')} DZD/${p.unit === 'PIECE' ? 'adet' : 'metre'}` : '—'}
                  </td>
                  <td>{p.stockQuantity.toLocaleString('tr-TR')}</td>
                  <td>{p.isActive ? 'Aktif' : 'Pasif'}</td>
                  {(canWrite || canDelete) && (
                    <td>
                      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                        {canWrite && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => openEdit(p)}
                          >
                            Düzenle
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => setDeleteTarget(p)}
                          >
                            Sil
                          </button>
                        )}
                      </div>
                    </td>
                  )}
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

      <Modal
        open={formOpen}
        title={editing ? 'Ürünü Düzenle' : 'Yeni Ürün'}
        onClose={() => {
          setFormOpen(false)
          setFormError('')
          setEditing(null)
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            Kod (SKU)
            <input
              required
              minLength={1}
              dir="ltr"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
          <label>
            Ürün adı
            <input
              required
              minLength={2}
              dir="ltr"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            Ürün Türü
            <select
              required
              dir="ltr"
              value={form.productType}
              onChange={(e) => {
                const productType = e.target.value as ProductForm['productType']
                setForm((f) => ({ ...f, productType, unit: productType === 'COLLAR' ? 'PIECE' : 'METER' }))
              }}
            >
              <option value="" disabled>Yaka veya Bant seçin</option>
              <option value="COLLAR">Yaka</option>
              <option value="BAND">Bant</option>
            </select>
          </label>
          <label>
            Satış birimi
            <input readOnly value={form.unit === 'PIECE' ? 'Adet' : 'Metre'} />
          </label>
          <label>
            İplik türü
            <input required dir="ltr" value={form.yarnType} onChange={(e) => setForm((f) => ({ ...f, yarnType: e.target.value }))} />
          </label>
          <label>
            Gramaj ({form.unit === 'PIECE' ? 'g/adet' : 'g/metre'})
            <input required type="number" min="0.0001" step="0.0001" dir="ltr" value={form.weightGramPerSaleUnit} onChange={(e) => setForm((f) => ({ ...f, weightGramPerSaleUnit: e.target.value }))} />
          </label>
          <label>
            İplik fiyatı (DZD/kg)
            <input type="number" min="0" step="0.01" dir="ltr" value={form.yarnPricePerKg} onChange={(e) => setForm((f) => ({ ...f, yarnPricePerKg: e.target.value }))} />
          </label>
          <label>
            Mevcut stok ({form.unit === 'PIECE' ? 'adet' : 'metre'})
            <input readOnly value={(editing?.stockQuantity ?? 0).toLocaleString('tr-TR')} />
          </label>
          <label>
            Stok kg karşılığı
            <input readOnly value={form.weightGramPerSaleUnit ? `${((Number(form.weightGramPerSaleUnit) * (editing?.stockQuantity ?? 0)) / 1000).toLocaleString('tr-TR')} kg` : '—'} />
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> Aktif
          </label>
          <label>
            Renk
            <input
              dir="ltr"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>
          <label>
            En (cm)
            <input
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={form.widthCm}
              onChange={(e) => setForm((f) => ({ ...f, widthCm: e.target.value }))}
            />
          </label>
          <label>
            Satış fiyatı (DZD)
            <input
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={form.salePrice}
              onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))}
            />
          </label>
          <label>
            Maliyet fiyatı (DZD)
            <input
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={form.costPrice}
              onChange={(e) => setForm((f) => ({ ...f, costPrice: e.target.value }))}
            />
          </label>
          {formError && (
            <p className="demo-notice" role="alert">
              {formError}
            </p>
          )}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setFormOpen(false)
                setFormError('')
                setEditing(null)
              }}
            >
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title="Ürünü sil"
        message={
          deleteTarget
            ? `"${deleteTarget.name}" silinecek. Stok veya üretim hareketlerinde kullanılan ürünler silinemez. Devam edilsin mi?`
            : ''
        }
        confirmLabel="Sil"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
