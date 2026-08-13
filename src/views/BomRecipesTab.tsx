import { useEffect, useState, type FormEvent } from 'react'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../data/api'
import type { CompanyPresentation } from '../data/companyBranding'
import { materialLabel, materialShortLabel } from '../data/industryLabels'

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
  const [boms, setBoms] = useState<Bom[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [productId, setProductId] = useState('')
  const [name, setName] = useState('Reçete')
  const [items, setItems] = useState<BomItem[]>([
    { materialProductId: 0, quantityPerUnit: 15, unit: 'GRAM', wastePercent: 3 },
  ])

  const load = async () => {
    try {
      const [bomRows, productRows] = await Promise.all([
        apiGet<Bom[]>('/boms'),
        apiGet<ProductOption[]>('/products').catch(() => [] as ProductOption[]),
      ])
      setBoms(bomRows)
      setProducts(productRows)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reçeteler alınamadı.')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    const validItems = items.filter((item) => item.materialProductId > 0)
    if (!productId || validItems.length === 0) {
      setError(`Mamul ve en az bir ${materialShortLabel(company).toLocaleLowerCase('tr-TR')} seçin.`)
      return
    }
    setSaving(true)
    try {
      await apiPost('/boms', {
        productId: Number(productId),
        name: name.trim() || 'Reçete',
        isActive: true,
        items: validItems,
      })
      setName('Reçete')
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Reçete kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel panel--full">
      <div className="panel__header">
        <h2>Reçeteler</h2>
        <p className="panel__meta">Aktif reçete üretim emrinin malzeme snapshot’ını üretir</p>
      </div>
      {error && (
        <p className="demo-notice" role="alert">
          {error}
        </p>
      )}
      {canWrite && (
        <form className="demo-form" onSubmit={(e) => void handleCreate(e)} style={{ padding: 16 }}>
          <label>
            Mamul
            <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="">Seçin</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.code} · {product.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Reçete adı
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
                <option value="">{materialLabel(company)}</option>
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
                <option value="PIECE">adet</option>
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
                title="Fire %"
              />
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
              + Malzeme
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Aktif reçete kaydet'}
            </button>
          </div>
        </form>
      )}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Mamul</th>
              <th>Reçete</th>
              <th>Versiyon</th>
              <th>Malzemeler</th>
              <th>Durum</th>
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
                      {item.materialName} · {item.quantityPerUnit} {UNIT_LABEL[item.unit]} / %
                      {item.wastePercent} fire
                    </div>
                  ))}
                </td>
                <td>{bom.isActive ? 'Aktif' : 'Pasif'}</td>
                {canWrite && (
                  <td>
                    {!bom.isActive && (
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => void apiPatch(`/boms/${bom.id}`, { isActive: true }).then(load)}
                      >
                        Aktifleştir
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--ghost"
                      onClick={() => void apiDelete(`/boms/${bom.id}`).then(load)}
                    >
                      Sil
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {boms.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 6 : 5} className="empty-cell">
                  Henüz reçete yok.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
