import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
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
import { useI18n } from '../i18n/I18nProvider'

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
  const colors = (() => {
    try {
      return resolveTextileColors(product.color, product.name)
    } catch {
      return [] as ReturnType<typeof resolveTextileColors>
    }
  })()
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
  const { locale, t, formatCurrency, formatNumber } = useI18n()
  const textile = isTextileCompany(company)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('__all__')
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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await apiGet<Product[]>('/products')
      setProducts(rows)
      setError('')
    } catch {
      setError(t('products.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const categories = useMemo(
    () => [
      '__all__',
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
        const matchesCat = category === '__all__' || p.category === category
        const matchesQuery =
          p.name.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)) ||
          p.code.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)) ||
          (p.category?.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)) ??
            false) ||
          (textile &&
            (p.color?.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)) ??
              false))
        return matchesCat && matchesQuery
      }),
    [products, search, category, textile, locale],
  )

  const categoryLabel = (value: string) => {
    if (value === '__all__') return t('products.all')
    if (value === 'Yaka') return t('products.type.COLLAR')
    if (value === 'Bant') return t('products.type.BAND')
    return value
  }

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
      setFormError(t('products.requiredError'))
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
      setSuccessNotice(editing ? t('products.updated') : t('products.created'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('products.saveError'))
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
      setSuccessNotice(t('products.deleted'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('products.deleteError'))
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
          { label: t('products.total'), value: loading ? '…' : formatNumber(products.length) },
          { label: t('products.activeProducts'), value: loading ? '…' : formatNumber(activeCount) },
          { label: t('products.criticalStock'), value: loading ? '…' : formatNumber(criticalCount) },
        ]}
      />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('products.catalog')}</h2>
          {canWrite ? (
            <button type="button" className="btn btn--primary" onClick={openCreate}>
              + {t('products.new')}
            </button>
          ) : (
            <span className="panel__meta">
              {loading ? t('common.loading') : t('products.count', { filtered: formatNumber(filtered.length), total: formatNumber(products.length) })}
            </span>
          )}
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={
            textile ? t('products.searchTextile') : t('products.search')
          }
          filter={category}
          filterOptions={categories.map((item) => ({ value: item, label: categoryLabel(item) }))}
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
                <th>{t('products.name')}</th>
                {textile && <th>{t('products.color')}</th>}
                {textile && <th>{t('products.type')}</th>}
                <th>{t('products.unit')}</th>
                {textile && <th>{t('products.weight')}</th>}
                <th>{t('products.saleDzd')}</th>
                <th>{t('products.stock')}</th>
                <th>{t('products.status')}</th>
                {(canWrite || canDelete) && <th>{t('products.actions')}</th>}
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
                  {textile && <td>{p.productType ? t(`products.type.${p.productType}`) : '—'}</td>}
                  <td>{t(`requests.unit.${p.unit}`)}</td>
                  {textile && <td>{p.weightGramPerSaleUnit != null ? `${formatNumber(p.weightGramPerSaleUnit)} g/${p.unit === 'PIECE' ? t('products.perPiece') : t('products.perMeter')}` : '—'}</td>}
                  <td className="amount-cell">
                    {p.salePrice != null ? `${formatCurrency(p.salePrice)}/${p.unit === 'PIECE' ? t('products.perPiece') : t('products.perMeter')}` : '—'}
                  </td>
                  <td>{formatNumber(p.stockQuantity)}</td>
                  <td>{p.isActive ? t('products.active') : t('products.inactive')}</td>
                  {(canWrite || canDelete) && (
                    <td>
                      <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                        {canWrite && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => openEdit(p)}
                          >
                            {t('products.edit')}
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn btn--ghost"
                            onClick={() => setDeleteTarget(p)}
                          >
                            {t('products.delete')}
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
                      ? t('products.empty')
                      : t('products.noSearchResult')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={formOpen}
        title={editing ? t('products.editTitle') : t('products.new')}
        onClose={() => {
          setFormOpen(false)
          setFormError('')
          setEditing(null)
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleSubmit(e)}>
          <label>
            {t('products.code')}
            <input
              required
              minLength={1}
              dir="ltr"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </label>
          <label>
            {t('products.name')}
            <input
              required
              minLength={2}
              dir="ltr"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </label>
          <label>
            {t('products.type')}
            <select
              required
              dir="ltr"
              value={form.productType}
              onChange={(e) => {
                const productType = e.target.value as ProductForm['productType']
                setForm((f) => ({ ...f, productType, unit: productType === 'COLLAR' ? 'PIECE' : 'METER' }))
              }}
            >
              <option value="" disabled>{t('products.selectType')}</option>
              <option value="COLLAR">{t('products.type.COLLAR')}</option>
              <option value="BAND">{t('products.type.BAND')}</option>
            </select>
          </label>
          <label>
            {t('products.saleUnit')}
            <input readOnly value={t(`requests.unit.${form.unit}`)} />
          </label>
          <label>
            {t('products.yarnType')}
            <input required dir="ltr" value={form.yarnType} onChange={(e) => setForm((f) => ({ ...f, yarnType: e.target.value }))} />
          </label>
          <label>
            {t('products.weightUnit', { unit: form.unit === 'PIECE' ? `g/${t('products.perPiece')}` : `g/${t('products.perMeter')}` })}
            <input required type="number" min="0.0001" step="0.0001" dir="ltr" value={form.weightGramPerSaleUnit} onChange={(e) => setForm((f) => ({ ...f, weightGramPerSaleUnit: e.target.value }))} />
          </label>
          <label>
            {t('products.yarnPrice')}
            <input type="number" min="0" step="0.01" dir="ltr" value={form.yarnPricePerKg} onChange={(e) => setForm((f) => ({ ...f, yarnPricePerKg: e.target.value }))} />
          </label>
          <label>
            {t('products.currentStock', { unit: form.unit === 'PIECE' ? t('products.perPiece') : t('products.perMeter') })}
            <input readOnly value={formatNumber(editing?.stockQuantity ?? 0)} />
          </label>
          <label>
            {t('products.stockKg')}
            <input readOnly value={form.weightGramPerSaleUnit ? `${formatNumber((Number(form.weightGramPerSaleUnit) * (editing?.stockQuantity ?? 0)) / 1000)} kg` : '—'} />
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> {t('products.active')}
          </label>
          <label>
            {t('products.color')}
            <input
              dir="ltr"
              value={form.color}
              onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            />
          </label>
          <label>
            {t('products.width')}
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
            {t('products.salePrice')}
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
            {t('products.costPrice')}
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
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t('products.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('products.deleteTitle')}
        message={
          deleteTarget
            ? t('products.deleteConfirm', { name: deleteTarget.name })
            : ''
        }
        confirmLabel={t('products.delete')}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  )
}
