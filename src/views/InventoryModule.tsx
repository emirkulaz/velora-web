import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import { ModuleSummary } from '../components/ModuleSummary'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiPost } from '../data/api'
import {
  isTextileCompany,
  type CompanyPresentation,
} from '../data/companyBranding'
import { useI18n } from '../i18n/I18nProvider'
import { OPEN_INVENTORY_MOVEMENT_FLAG } from './inventoryActions'

interface StockBalance {
  productId: number
  code: string
  name: string
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
  color: string | null
  widthCm: number | null
  category: string | null
  yarnType: string | null
  productType: string | null
  costPrice: number | null
  unitCost: number | null
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  totalValue: number | null
  valueComputable: boolean
  valueNote: string | null
  criticalLevel?: number
  isCritical?: boolean
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
type MovementKind = 'finished' | 'yarn'

function yarnKindLabel(item: StockBalance) {
  return item.yarnType || item.category || item.productType || '—'
}

export function InventoryModule({
  company,
  kind = 'finished',
  canWrite = false,
  canManageWarehouses = false,
}: {
  company: CompanyPresentation | null
  kind?: 'finished' | 'yarn'
  canWrite?: boolean
  canManageWarehouses?: boolean
}) {
  const { locale, t, formatNumber } = useI18n()
  const formatQty = (value: number) =>
    formatNumber(value, { maximumFractionDigits: 3 })
  const formatMoney = (value: number) =>
    formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const textile = isTextileCompany(company)
  const isYarnInventory = kind === 'yarn'
  const inventoryLabel = t(`inventory.title.${kind}`)
  const inventoryLede = t(`inventory.lede.${kind}`)
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
  const [movementKind, setMovementKind] = useState<MovementKind>(kind)
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

  const loadBalances = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await apiGet<StockBalance[]>(`/stock/balances?kind=${kind}`)
      setBalances(rows)
      setError('')
    } catch {
      setError(t('inventory.loadError'))
    } finally {
      setLoading(false)
    }
  }, [kind, t])

  const loadSelectOptions = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBalances()
      void loadSelectOptions()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadBalances, loadSelectOptions])

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

  const openMovement = (nextAction: StockAction, nextKind: MovementKind = kind) => {
    resetForm()
    setAction(nextAction)
    setMovementKind(nextKind)
    setFormOpen(true)
  }

  useEffect(() => {
    if (!canWrite) return
    let shouldOpen = false
    try {
      if (sessionStorage.getItem(OPEN_INVENTORY_MOVEMENT_FLAG) === '1') {
        sessionStorage.removeItem(OPEN_INVENTORY_MOVEMENT_FLAG)
        shouldOpen = true
      }
    } catch {
      // ignore storage errors
    }
    if (!shouldOpen) return
    const timeoutId = window.setTimeout(() => {
        setAction('INBOUND')
        setMovementKind(kind)
        setProductId('')
        setWarehouseId('')
        setQuantity('')
        setPackageCount('')
        setUnitCost('')
        setReference('')
        setNote('')
        setFormError('')
        setFormOpen(true)
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [canWrite, kind])

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    if (!productId || !warehouseId) {
      setFormError(t('inventory.selectProductWarehouse'))
      return
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty < 0.001) {
      setFormError(t('inventory.invalidQuantity'))
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
        action === 'INBOUND' ? t('inventory.inboundSaved') : t('inventory.outboundSaved'),
      )
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('inventory.movementSaveError'))
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
      setSuccessNotice(t('inventory.warehouseSaved'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('inventory.warehouseSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const selectableProducts = useMemo(
    () =>
      products.filter((p) =>
        movementKind === 'yarn' ? p.unit === 'KILOGRAM' : p.unit !== 'KILOGRAM',
      ),
    [products, movementKind],
  )

  const filtered = useMemo(() => {
    const query = search.toLocaleLowerCase(locale)
    return balances.filter((item) =>
      [
        item.name,
        item.code,
        item.color ?? '',
        item.yarnType ?? '',
        item.category ?? '',
        ...item.warehouses.map((warehouse) => warehouse.name),
      ].some((value) => value.toLocaleLowerCase(locale).includes(query)),
    )
  }, [balances, locale, search])

  const totalMeters = balances
    .filter((item) => item.unit === 'METER')
    .reduce((sum, item) => sum + item.quantity, 0)
  const totalPieces = balances
    .filter((item) => item.unit === 'PIECE')
    .reduce((sum, item) => sum + item.quantity, 0)
  const totalKilograms = balances
    .filter((item) => item.unit === 'KILOGRAM')
    .reduce((sum, item) => sum + item.quantity, 0)
  const criticalCount = balances.filter((item) =>
    item.isCritical ?? item.quantity <= (item.criticalLevel ?? (isYarnInventory ? 10 : 0)),
  ).length
  const valued = balances.filter((item) => item.valueComputable && item.totalValue != null)
  const totalStockValue = valued.reduce((sum, item) => sum + (item.totalValue ?? 0), 0)
  const missingCostCount = balances.length - valued.length

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />
      <ModuleSummary
        items={[
          ...(isYarnInventory
            ? [{ label: t('inventory.totalYarn'), value: loading ? '…' : formatQty(totalKilograms), unit: 'kg' }]
            : [
                { label: t('inventory.totalMeters'), value: loading ? '…' : formatQty(totalMeters), unit: 'm' },
                { label: t('inventory.totalPieces'), value: loading ? '…' : formatQty(totalPieces) },
              ]),
          { label: t('inventory.criticalLevel'), value: loading ? '…' : formatNumber(criticalCount) },
          {
            label: t('inventory.totalValue'),
            value: loading
              ? '…'
              : missingCostCount === balances.length && balances.length > 0
                ? t('inventory.notComputable')
                : formatMoney(totalStockValue),
            unit:
              missingCostCount === balances.length && balances.length > 0 ? undefined : 'DZD',
          },
        ]}
      />

      {missingCostCount > 0 && balances.length > 0 && (
        <p className="demo-notice">
          {t('inventory.missingCost', { count: formatNumber(missingCostCount) })}
        </p>
      )}

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{inventoryLabel}</h2>
          {canWrite ? (
            <div className="panel__header-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => openMovement('INBOUND')}
              >
                {t('inventory.action.INBOUND')}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => openMovement('OUTBOUND')}
              >
                {t('inventory.action.OUTBOUND')}
              </button>
            </div>
          ) : (
            <span className="panel__meta">
              {loading ? t('common.loading') : t('inventory.itemCount', { count: formatNumber(filtered.length) })}
            </span>
          )}
        </div>
        <p className="inventory-lede">{inventoryLede}</p>
        {!isYarnInventory && (
          <ul className="inventory-examples">
            <li>{t('inventory.example.collar')}</li>
            <li>{t('inventory.example.band')}</li>
            <li>{t('inventory.example.cuff')}</li>
            <li>{t('inventory.example.other')}</li>
          </ul>
        )}
        <ModuleToolbar
          reportType="stock"
          reportLabel={t('inventory.report')}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t(`inventory.search.${kind}`)}
        />
        {error && (
          <p className="demo-notice" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && balances.length === 0 ? (
          <div className="empty-state empty-state--cta inventory-empty">
            <p>
              {isYarnInventory
                ? t('inventory.empty.yarn')
                : t('inventory.empty.finished')}
            </p>
            {canWrite && (
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => openMovement('INBOUND')}
              >
                {isYarnInventory ? t('inventory.addYarn') : t('inventory.addStock')}
              </button>
            )}
          </div>
        ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {isYarnInventory ? (
                  <>
                    <th>{t('inventory.materialName')}</th>
                    <th>{t('inventory.type')}</th>
                    <th>{t('inventory.color')}</th>
                    <th>{t('inventory.currentKg')}</th>
                    <th>{t('inventory.unitCostKg')}</th>
                    <th>{t('inventory.stockValue')}</th>
                    <th>{t('inventory.criticalLevel')}</th>
                  </>
                ) : (
                  <>
                    <th>{t('inventory.product')}</th>
                    {textile && <th>{t('inventory.color')}</th>}
                    {textile && <th>{t('inventory.measure')}</th>}
                    <th>{t('inventory.unit')}</th>
                    <th>{t('inventory.currentQuantity')}</th>
                    <th>{t('inventory.reserved')}</th>
                    <th>{t('inventory.available')}</th>
                    <th>{t('inventory.unitCost')}</th>
                    <th>{t('inventory.totalValue')}</th>
                    <th>{t('inventory.criticalLevel')}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => {
                const critical = item.criticalLevel ?? (isYarnInventory ? 10 : 0)
                return (
                <tr key={item.productId}>
                  <td>
                    <div>{item.name}</div>
                    <div className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                      {item.code}
                    </div>
                  </td>
                  {isYarnInventory ? (
                    <>
                      <td>{yarnKindLabel(item)}</td>
                      <td>{item.color ?? '—'}</td>
                      <td>{formatQty(item.quantity)}</td>
                      <td className="amount-cell">
                        {item.unitCost != null ? formatMoney(item.unitCost) : '—'}
                      </td>
                      <td className="amount-cell">
                        {item.valueComputable && item.totalValue != null
                          ? formatMoney(item.totalValue)
                          : item.valueNote ?? '—'}
                      </td>
                      <td>{formatQty(critical)} kg</td>
                    </>
                  ) : (
                    <>
                      {textile && <td>{item.color ?? '—'}</td>}
                      {textile && (
                        <td>
                          {item.widthCm != null ? `${formatNumber(item.widthCm)} cm` : '—'}
                        </td>
                      )}
                      <td>{t(`requests.unit.${item.unit}`)}</td>
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
                      <td>{formatQty(critical)}</td>
                    </>
                  )}
                </tr>
              )})}
              {!loading && !error && filtered.length === 0 && (
                <tr>
                  <td colSpan={isYarnInventory ? 7 : textile ? 10 : 8} className="empty-cell">
                    {t('inventory.noSearchResult')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('inventory.warehouses')}</h2>
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
                + {t('inventory.newWarehouse')}
              </button>
            </div>
          )}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('inventory.code')}</th>
                <th>{t('inventory.warehouse')}</th>
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
                    {t('inventory.noWarehouses')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={formOpen}
        title={t(`inventory.action.${action}`)}
        onClose={() => {
          setFormOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(e) => void handleCreate(e)}>
          <label>
            {t('inventory.movementType')}
            <select
              dir="ltr"
              value={action}
              onChange={(e) => setAction(e.target.value as StockAction)}
            >
              <option value="INBOUND">{t('inventory.action.INBOUND')}</option>
              <option value="OUTBOUND">{t('inventory.action.OUTBOUND')}</option>
            </select>
          </label>
          <label>
            {t('inventory.stockKind')}
            <select
              dir="ltr"
              value={movementKind}
              onChange={(e) => {
                setMovementKind(e.target.value as MovementKind)
                setProductId('')
              }}
            >
              <option value="finished">{t('inventory.kind.finished')}</option>
              <option value="yarn">{t('inventory.kind.yarn')}</option>
            </select>
          </label>
          <label>
            {movementKind === 'yarn' ? t('inventory.yarnMaterial') : t('inventory.finishedProduct')}
            <select
              required
              dir="ltr"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">{t('inventory.select')}</option>
              {selectableProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('inventory.warehouse')}
            <select
              required
              dir="ltr"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="">{t('inventory.select')}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} — {w.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {movementKind === 'yarn' ? t('inventory.quantityKg') : t('inventory.quantityFinished')}
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
            {t('inventory.packageCount')}
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
            {t('inventory.unitCostOptional')}
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
            {t('inventory.reference')}
            <input
              dir="ltr"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <label>
            {t('inventory.note')}
            <textarea
              rows={2}
              dir="ltr"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {(selectableProducts.length === 0 || warehouses.length === 0) && (
            <p className="demo-notice" role="status">
              {selectableProducts.length === 0
                ? movementKind === 'yarn'
                  ? t('inventory.createYarnFirst')
                  : t('inventory.createFinishedFirst')
                : t('inventory.createWarehouseFirst')}
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
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={saving || selectableProducts.length === 0 || warehouses.length === 0}
            >
              {saving ? t('inventory.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={warehouseFormOpen}
        title={t('inventory.newWarehouse')}
        onClose={() => {
          setWarehouseFormOpen(false)
          setFormError('')
        }}
      >
        <form className="demo-form" onSubmit={(event) => void handleWarehouseCreate(event)}>
          <label>
            {t('inventory.warehouseCode')}
            <input
              required
              value={warehouseCode}
              onChange={(event) => setWarehouseCode(event.target.value)}
            />
          </label>
          <label>
            {t('inventory.warehouseName')}
            <input
              required
              minLength={2}
              value={warehouseName}
              onChange={(event) => setWarehouseName(event.target.value)}
            />
          </label>
          <label>
            {t('inventory.address')}
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
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              {saving ? t('inventory.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
