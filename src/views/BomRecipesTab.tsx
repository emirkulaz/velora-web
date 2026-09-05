import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../data/api'
import { isTextileCompany, type CompanyPresentation } from '../data/companyBranding'
import { useI18n } from '../i18n/I18nProvider'

type ProductOption = {
  id: number
  code: string
  name: string
  unit: string
}

type BomItem = {
  id?: number
  materialProductId: number
  materialCode?: string
  materialName?: string
  quantityPerUnit: number
  unit:
    | 'GRAM'
    | 'KILOGRAM'
    | 'MILLIMETER'
    | 'CENTIMETER'
    | 'METER'
    | 'PIECE'
    | 'MILLILITER'
    | 'LITER'
  wastePercent: number
  notes?: string | null
  yarnMaterial?: string | null
  yarnColor?: string | null
  yarnCount?: string | null
  denier?: number | null
}

type Bom = {
  id: number
  productId: number
  productCode: string
  productName: string
  name: string
  version: number
  isActive: boolean
  items: BomItem[]
  productType?: 'STRIP' | 'SCARF' | 'WRISTBAND' | 'COLLAR' | 'CUFF' | 'OTHER' | 'BAND' | null
  outputUnit?: string | null
  theoreticalWeightGrams?: number | null
  machineProgram?: string | null
  pattern?: string | null
  gauge?: number | null
  estimatedMinutesPerUnit?: number | null
  expectedWastePercent?: number | null
}

const UNIT_LABEL: Record<BomItem['unit'], string> = {
  GRAM: 'g',
  KILOGRAM: 'kg',
  MILLIMETER: 'mm',
  CENTIMETER: 'cm',
  METER: 'm',
  PIECE: 'adet',
  MILLILITER: 'ml',
  LITER: 'l',
}

export function BomRecipesTab({
  company = null,
  canWrite = false,
}: {
  company?: CompanyPresentation | null
  canWrite?: boolean
}) {
  const { t, formatNumber } = useI18n()
  const materialName = t(isTextileCompany(company) ? 'boms.textileMaterial' : 'boms.material')
  const [boms, setBoms] = useState<Bom[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [error, setError] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState('')
  const [name, setName] = useState(() => t('boms.defaultName'))
  const [deleteTarget, setDeleteTarget] = useState<Bom | null>(null)
  const [editingBom, setEditingBom] = useState<Bom | null>(null)
  const [items, setItems] = useState<BomItem[]>([
    { materialProductId: 0, quantityPerUnit: 15, unit: 'GRAM', wastePercent: 3 },
  ])
  const [recipeMeta, setRecipeMeta] = useState({
    productType: 'OTHER', outputUnit: 'PIECE', theoreticalWeightGrams: '', machineProgram: '', pattern: '', gauge: '', estimatedMinutesPerUnit: '', expectedWastePercent: '',
  })

  const resetForm = useCallback(() => {
    setEditingBom(null)
    setProductId('')
    setName(t('boms.defaultName'))
    setItems([{ materialProductId: 0, quantityPerUnit: 15, unit: 'GRAM', wastePercent: 3 }])
    setRecipeMeta({ productType: 'OTHER', outputUnit: 'PIECE', theoreticalWeightGrams: '', machineProgram: '', pattern: '', gauge: '', estimatedMinutesPerUnit: '', expectedWastePercent: '' })
  }, [t])

  const load = useCallback(async () => {
    try {
      const [bomRows, productRows] = await Promise.all([
        apiGet<Bom[]>('/boms'),
        apiGet<ProductOption[]>('/products').catch(() => [] as ProductOption[]),
      ])
      setBoms(bomRows)
      setProducts(productRows)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('boms.loadError'))
    }
  }, [t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const openEdit = (bom: Bom) => {
    setEditingBom(bom)
    setProductId(String(bom.productId))
    setName(bom.name)
    setItems(
      bom.items.length > 0
        ? bom.items.map((item) => ({
            materialProductId: item.materialProductId,
            quantityPerUnit: item.quantityPerUnit,
            unit: item.unit,
            wastePercent: item.wastePercent,
            notes: item.notes,
            yarnMaterial: item.yarnMaterial,
            yarnColor: item.yarnColor,
            yarnCount: item.yarnCount,
            denier: item.denier,
          }))
        : [{ materialProductId: 0, quantityPerUnit: 1, unit: 'GRAM', wastePercent: 0 }],
    )
    setRecipeMeta({
      productType: bom.productType ?? 'OTHER',
      outputUnit: bom.outputUnit ?? 'PIECE',
      theoreticalWeightGrams: bom.theoreticalWeightGrams == null ? '' : String(bom.theoreticalWeightGrams),
      machineProgram: bom.machineProgram ?? '',
      pattern: bom.pattern ?? '',
      gauge: bom.gauge == null ? '' : String(bom.gauge),
      estimatedMinutesPerUnit: bom.estimatedMinutesPerUnit == null ? '' : String(bom.estimatedMinutesPerUnit),
      expectedWastePercent: bom.expectedWastePercent == null ? '' : String(bom.expectedWastePercent),
    })
    setError('')
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    const validItems = items.filter((item) => item.materialProductId > 0)
    if (!productId || validItems.length === 0) {
      setError(t('boms.validation', { material: materialName.toLocaleLowerCase() }))
      return
    }
    setSaving(true)
    try {
      const metadata = {
        productType: recipeMeta.productType,
        outputUnit: recipeMeta.outputUnit,
        theoreticalWeightGrams: recipeMeta.theoreticalWeightGrams ? Number(recipeMeta.theoreticalWeightGrams) : undefined,
        machineProgram: recipeMeta.machineProgram || undefined,
        pattern: recipeMeta.pattern || undefined,
        gauge: recipeMeta.gauge ? Number(recipeMeta.gauge) : undefined,
        estimatedMinutesPerUnit: recipeMeta.estimatedMinutesPerUnit ? Number(recipeMeta.estimatedMinutesPerUnit) : undefined,
        expectedWastePercent: recipeMeta.expectedWastePercent ? Number(recipeMeta.expectedWastePercent) : undefined,
      }
      if (editingBom) {
        await apiPatch(`/boms/${editingBom.id}`, {
          name: name.trim() || t('boms.defaultName'),
          items: validItems,
          ...metadata,
        })
        setSuccessNotice(t('boms.updated'))
      } else {
        await apiPost('/boms', {
          productId: Number(productId),
          name: name.trim() || t('boms.defaultName'),
          isActive: true,
          items: validItems,
          ...metadata,
        })
      }
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('boms.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (bom: Bom) => {
    if (!canWrite || saving) return
    setSaving(true)
    setError('')
    try {
      await apiPatch(`/boms/${bom.id}`, { isActive: true })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('boms.actionError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canWrite || saving) return
    setSaving(true)
    setError('')
    try {
      await apiDelete(`/boms/${deleteTarget.id}`)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('boms.actionError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
    <section className="panel panel--full">
      <div className="panel__header">
        <h2>{t('boms.title')}</h2>
        <p className="panel__meta">{t('boms.description')}</p>
      </div>
      {error && (
        <p className="demo-notice" role="alert">
          {error}
        </p>
      )}
      {canWrite && (
        <form className="demo-form" onSubmit={(e) => void handleSave(e)} style={{ padding: 16 }}>
          {editingBom && (
            <p className="panel__meta" style={{ marginBottom: 8 }}>
              {t('boms.editing', { name: editingBom.name })}
            </p>
          )}
          <label>
            {t('boms.finishedProduct')}
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={Boolean(editingBom)}
            >
              <option value="">{t('boms.select')}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} · {product.name}
                </option>
              ))}
            </select>
          </label>
          <div className="machine-form__row">
            <label>{t('boms.productType')}<select value={recipeMeta.productType} onChange={(event) => setRecipeMeta((value) => ({ ...value, productType: event.target.value }))}>{['STRIP', 'SCARF', 'WRISTBAND', 'COLLAR', 'CUFF', 'OTHER'].map((value) => <option key={value} value={value}>{t(`boms.productType.${value}`)}</option>)}</select></label>
            <label>{t('boms.outputUnit')}<select value={recipeMeta.outputUnit} onChange={(event) => setRecipeMeta((value) => ({ ...value, outputUnit: event.target.value }))}><option value="PIECE">{t('requests.unit.PIECE')}</option><option value="METER">{t('requests.unit.METER')}</option></select></label>
            <label>{t('boms.theoreticalGrams')}<input type="number" min="0.0001" step="0.0001" value={recipeMeta.theoreticalWeightGrams} onChange={(event) => setRecipeMeta((value) => ({ ...value, theoreticalWeightGrams: event.target.value }))} /></label>
          </div>
          <div className="machine-form__row">
            <label>{t('boms.machineProgram')}<input value={recipeMeta.machineProgram} onChange={(event) => setRecipeMeta((value) => ({ ...value, machineProgram: event.target.value }))} /></label>
            <label>{t('boms.pattern')}<input value={recipeMeta.pattern} onChange={(event) => setRecipeMeta((value) => ({ ...value, pattern: event.target.value }))} /></label>
            <label>{t('boms.gauge')}<input type="number" min="1" value={recipeMeta.gauge} onChange={(event) => setRecipeMeta((value) => ({ ...value, gauge: event.target.value }))} /></label>
            <label>{t('boms.estimatedTime')}<input type="number" min="0.001" step="0.001" value={recipeMeta.estimatedMinutesPerUnit} onChange={(event) => setRecipeMeta((value) => ({ ...value, estimatedMinutesPerUnit: event.target.value }))} /></label>
            <label>{t('boms.expectedWaste')}<input type="number" min="0" max="100" step="0.01" value={recipeMeta.expectedWastePercent} onChange={(event) => setRecipeMeta((value) => ({ ...value, expectedWastePercent: event.target.value }))} /></label>
          </div>
          <label>
            {t('boms.name')}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {items.map((item, index) => (
            <div key={index} className="form-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
              <select
                required
                value={item.materialProductId || ''}
                onChange={(e) => {
                  const next = [...items]
                  next[index] = { ...item, materialProductId: Number(e.target.value) }
                  setItems(next)
                }}
              >
                <option value="">{materialName}</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} · {product.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={item.quantityPerUnit}
                onChange={(e) => {
                  const next = [...items]
                  next[index] = { ...item, quantityPerUnit: Number(e.target.value) }
                  setItems(next)
                }}
                style={{ width: 110 }}
              />
              <select
                value={item.unit}
                onChange={(e) => {
                  const next = [...items]
                  next[index] = { ...item, unit: e.target.value as BomItem['unit'] }
                  setItems(next)
                }}
              >
                <option value="GRAM">g</option>
                <option value="KILOGRAM">kg</option>
                <option value="MILLIMETER">mm</option>
                <option value="CENTIMETER">cm</option>
                <option value="METER">m</option>
                <option value="PIECE">{t('requests.unit.PIECE')}</option>
                <option value="MILLILITER">ml</option>
                <option value="LITER">l</option>
              </select>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={item.wastePercent}
                onChange={(e) => {
                  const next = [...items]
                  next[index] = { ...item, wastePercent: Number(e.target.value) }
                  setItems(next)
                }}
                style={{ width: 80 }}
                title={t('boms.waste')}
              />
              <input placeholder={t('boms.yarnMaterial')} value={item.yarnMaterial ?? ''} onChange={(event) => { const next = [...items]; next[index] = { ...item, yarnMaterial: event.target.value }; setItems(next) }} />
              <input placeholder={t('boms.yarnColor')} value={item.yarnColor ?? ''} onChange={(event) => { const next = [...items]; next[index] = { ...item, yarnColor: event.target.value }; setItems(next) }} />
              <input placeholder={t('boms.yarnCount')} value={item.yarnCount ?? ''} onChange={(event) => { const next = [...items]; next[index] = { ...item, yarnCount: event.target.value }; setItems(next) }} />
              <input type="number" min="1" placeholder={t('boms.denier')} value={item.denier ?? ''} onChange={(event) => { const next = [...items]; next[index] = { ...item, denier: event.target.value ? Number(event.target.value) : null }; setItems(next) }} style={{ width: 95 }} />
            </div>
          ))}
          <div className="form-actions">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { materialProductId: 0, quantityPerUnit: 1, unit: 'GRAM', wastePercent: 0 },
                ])
              }
            >
              + {t('boms.addMaterial')}
            </button>
            {editingBom && (
              <button type="button" className="btn btn--ghost" onClick={resetForm} disabled={saving}>
                {t('boms.cancelEdit')}
              </button>
            )}
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving
                ? t('boms.saving')
                : editingBom
                  ? t('boms.saveChanges')
                  : t('boms.saveActive')}
            </button>
          </div>
        </form>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('boms.finishedProduct')}</th>
              <th>{t('boms.recipe')}</th>
              <th>{t('boms.version')}</th>
              <th>{t('boms.materials')}</th>
              <th>{t('boms.status')}</th>
              {canWrite && <th />}
            </tr>
          </thead>
          <tbody>
            {boms.map((bom) => (
              <tr key={bom.id}>
                <td>
                  {bom.productName}
                  <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                    {bom.productCode}
                  </div>
                </td>
                <td>{bom.name}</td>
                <td>v{bom.version}</td>
                <td>
                  {bom.items.map((item) => (
                    <div key={`${bom.id}-${item.materialProductId}`}>
                      {item.materialName} · {formatNumber(item.quantityPerUnit)} {item.unit === 'PIECE' ? t('requests.unit.PIECE') : UNIT_LABEL[item.unit]} / {t('boms.wasteValue', { value: formatNumber(item.wastePercent) })}
                    </div>
                  ))}
                </td>
                <td>{bom.isActive ? t('boms.active') : t('boms.inactive')}</td>
                {canWrite && (
                  <td>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={saving}
                      onClick={() => openEdit(bom)}
                    >
                      {t('boms.edit')}
                    </button>
                    {!bom.isActive && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={saving}
                        onClick={() => void handleActivate(bom)}
                      >
                        {t('boms.activate')}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={saving}
                      onClick={() => setDeleteTarget(bom)}
                    >
                      {t('boms.delete')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {boms.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="empty-cell">
                  {t('boms.empty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
    <ConfirmDialog
      open={deleteTarget != null}
      title={t('boms.deleteTitle')}
      message={deleteTarget ? t('boms.deleteConfirm', { name: deleteTarget.name }) : ''}
      confirmLabel={t('boms.delete')}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => void handleDelete()}
    />
    </>
  )
}
