import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiPost } from '../data/api'
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

type ProductOption = {
  id: number
  code: string
  name: string
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
}

type WarehouseOption = {
  id: number
  code: string
  name: string
}

type StockAction = 'INBOUND' | 'OUTBOUND'

const OPEN_MOVEMENT_FLAG = 'velora.inventory.openMovement'

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
  canWrite = false,
  canManageWarehouses = false,
}: {
  company: CompanyPresentation | null
  canWrite?: boolean
  canManageWarehouses?: boolean
}) {
  const textile = isTextileCompany(company)
  const [search, setSearch] = useState('')
  const [balances, setBalances] = useState<StockBalance[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false)
  const [successNotice, setSuccessNotice] = useState('')

  const [action, setAction] = useState<StockAction>('INBOUND')
  const [productId, setProductId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [packageCount, setPackageCount] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [warehouseCode, setWarehouseCode] = useState('')
  const [warehouseName, setWarehouseName] = useState('')
  const [warehouseAddress, setWarehouseAddress] = useState('')

  const loadBalances = async () => {
    setLoading(true)
    try {
      const rows = await apiGet<StockBalance[]>('/stock/balances')
      setBalances(rows)
      setError('')
    } catch {
      setError('Stok verileri alınamadı.')
    } finally {
      setLoading(false)
    }
  }

  const loadSelectOptions = async () => {
    try {
      const [productRows, warehouseRows] = await Promise.all([
        apiGet<ProductOption[]>('/products'),
        apiGet<WarehouseOption[]>('/warehouses'),
      ])
      setProducts(
        productRows.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          unit: p.unit,
        })),
      )
      setWarehouses(
        warehouseRows.map((w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
        })),
      )
    } catch {
      // Selects stay empty; form will show notice if needed.
    }
  }

  useEffect(() => {
    void loadBalances()
    void loadSelectOptions()
  }, [])

  const resetForm = () => {
    setAction('INBOUND')
    setProductId('')
    setWarehouseId('')
    setQuantity('')
    setPackageCount('')
    setUnitCost('')
    setReference('')
    setNote('')
    setFormError('')
  }

  const openMovement = (nextAction: StockAction) => {
    resetForm()
    setAction(nextAction)
    setFormOpen(true)
  }

  useEffect(() => {
    if (!canWrite) return
    try {
      if (sessionStorage.getItem(OPEN_MOVEMENT_FLAG) === '1') {
        sessionStorage.removeItem(OPEN_MOVEMENT_FLAG)
        setAction('INBOUND')
        setProductId('')
        setWarehouseId('')
        setQuantity('')
        setPackageCount('')
        setUnitCost('')
        setReference('')
        setNote('')
        setFormError('')
        setFormOpen(true)
      }
    } catch {
      // ignore storage errors
    }
  }, [canWrite])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!productId || !warehouseId) {
      setFormError('Ürün ve depo seçin.')
      return
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty < 0.001) {
      setFormError('Geçerli bir miktar girin.')
      return
    }
    setSaving(true)
    setFormError('')
    setError('')
    try {
      await apiPost('/stock/movements', {
        action,
        productId: Number(productId),
        warehouseId: Number(warehouseId),
        quantity: qty,
        packageCount: packageCount ? Number(packageCount) : undefined,
        unitCost: unitCost ? Number(unitCost) : undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
      })
      setFormOpen(false)
      resetForm()
      await loadBalances()
      setSuccessNotice(
        action === 'INBOUND' ? 'Stok girişi kaydedildi.' : 'Stok çıkışı kaydedildi.',
      )
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Stok hareketi kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  const handleWarehouseCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canManageWarehouses || saving) return
    setSaving(true)
    setFormError('')
    try {
      await apiPost('/warehouses', {
        code: warehouseCode.trim(),
        name: warehouseName.trim(),
        address: warehouseAddress.trim() || undefined,
      })
      setWarehouseFormOpen(false)
      setWarehouseCode('')
      setWarehouseName('')
      setWarehouseAddress('')
      await loadSelectOptions()
      setSuccessNotice('Depo kaydedildi.')
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Depo kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

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
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
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
          {canWrite ? (
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => openMovement('INBOUND')}
              >
                Stok Girişi
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => openMovement('OUTBOUND')}
              >
                Stok Çıkışı
              </button>
            </div>
          ) : (
            <span className="panel__meta">
              {loading ? 'Yükleniyor…' : `${filtered.length} kalem`}
            </span>
          )}
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ürün, SKU, renk veya depo ara..."
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

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Depolar</h2>
          {canManageWarehouses && (
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  setWarehouseCode('')
                  setWarehouseName('')
                  setWarehouseAddress('')
                  setFormError('')
                  setWarehouseFormOpen(true)
                }}
              >
                + Yeni Depo
              </button>
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Depo</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map((warehouse) => (
                <tr key={warehouse.id}>
                  <td className="mono">{warehouse.code}</td>
                  <td>{warehouse.name}</td>
                </tr>
              ))}
              {warehouses.length === 0 && (
                <tr>
                  <td colSpan={2} className="empty-cell">
                    Henüz depo kaydı yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={formOpen}
        title={action === 'INBOUND' ? 'Stok Girişi' : 'Stok Çıkışı'}
        onClose={() => {
          setFormOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCreate(e)}>
          <label>
            Hareket tipi
            <select
              dir="ltr"
              value={action}
              onChange={(e) => setAction(e.target.value as StockAction)}
            >
              <option value="INBOUND">Giriş (INBOUND)</option>
              <option value="OUTBOUND">Çıkış (OUTBOUND)</option>
            </select>
          </label>
          <label>
            Ürün
            <select
              required
              dir="ltr"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Seçin</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Depo
            <select
              required
              dir="ltr"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">Seçin</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Miktar
            <input
              type="number"
              min="0.001"
              step="0.001"
              required
              dir="ltr"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            Paket sayısı (opsiyonel)
            <input
              type="number"
              min="0"
              step="1"
              dir="ltr"
              value={packageCount}
              onChange={(e) => setPackageCount(e.target.value)}
            />
          </label>
          <label>
            Birim maliyet (opsiyonel)
            <input
              type="number"
              min="0"
              step="0.01"
              dir="ltr"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
            />
          </label>
          <label>
            Referans (opsiyonel)
            <input
              dir="ltr"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            Not (opsiyonel)
            <textarea
              rows={2}
              dir="ltr"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {(products.length === 0 || warehouses.length === 0) && (
            <p className="demo-notice" role="status">
              {products.length === 0
                ? 'Önce ürün kaydı oluşturun.'
                : 'Önce depo kaydı oluşturun.'}
            </p>
          )}
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
              }}
            >
              Vazgeç
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || products.length === 0 || warehouses.length === 0}
            >
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={warehouseFormOpen}
        title="Yeni Depo"
        onClose={() => {
          setWarehouseFormOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(event) => void handleWarehouseCreate(event)}>
          <label>
            Depo kodu
            <input
              required
              value={warehouseCode}
              onChange={(event) => setWarehouseCode(event.target.value)}
            />
          </label>
          <label>
            Depo adı
            <input
              required
              minLength={2}
              value={warehouseName}
              onChange={(event) => setWarehouseName(event.target.value)}
            />
          </label>
          <label>
            Adres
            <textarea
              rows={2}
              value={warehouseAddress}
              onChange={(event) => setWarehouseAddress(event.target.value)}
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
              onClick={() => setWarehouseFormOpen(false)}
            >
              Vazgeç
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}

/** Günlük İşler vb. → stok hareketi modalını açar. */
export function markOpenInventoryMovement(): void {
  try {
    sessionStorage.setItem(OPEN_MOVEMENT_FLAG, '1')
  } catch {
    // ignore
  }
}
