import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Modal } from '../components/Modal'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiGet, apiPatch, apiPost } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

type MachineStatus =
  | 'AVAILABLE'
  | 'RUNNING'
  | 'STOPPED'
  | 'MAINTENANCE'
  | 'FAULTED'
  | 'INACTIVE'

type ActiveOrder = {
  id: number
  orderNumber: string
  productName: string
  plannedQuantity: number
  goodQuantity: number
  defectiveQuantity: number
  scrapQuantity: number
  yarnUsedQuantity: number
  unit: string
  progress: number
  efficiency: number
  downtimeReason: string | null
  operator: { id: number; name: string } | null
  yarnLot: { id: number; lotNumber: string } | null
}

type Machine = {
  id: number
  code: string
  name: string
  model: string | null
  gauge: number | null
  workingWidthCm: number | null
  feederCount: number | null
  serialNumber: string | null
  status: MachineStatus
  notes: string | null
  activeOrder: ActiveOrder | null
}

type OrderOption = {
  id: number
  orderNumber: string
  productName: string | null
  status: string
}

type EmployeeOption = { id: number; name: string; isActive?: boolean }
type ProductOption = { id: number; code: string; name: string; unit: string }
type WarehouseOption = { id: number; code: string; name: string }
type YarnLot = {
  id: number
  productId: number
  productName: string
  lotNumber: string
  remainingWeightKg: number
}

const FILTERS: Array<'ALL' | MachineStatus> = [
  'ALL',
  'RUNNING',
  'AVAILABLE',
  'STOPPED',
  'MAINTENANCE',
  'FAULTED',
  'INACTIVE',
]

const emptyMachineForm = {
  code: '',
  name: '',
  model: '',
  gauge: '',
  workingWidthCm: '',
  feederCount: '',
  serialNumber: '',
  status: 'AVAILABLE' as MachineStatus,
  notes: '',
}

export function MachineProductionTab({ canWrite = false }: { canWrite?: boolean }) {
  const { t, formatNumber } = useI18n()
  const [machines, setMachines] = useState<Machine[]>([])
  const [orders, setOrders] = useState<OrderOption[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [lots, setLots] = useState<YarnLot[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([])
  const [filter, setFilter] = useState<'ALL' | MachineStatus>('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [machineFormOpen, setMachineFormOpen] = useState(false)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [machineForm, setMachineForm] = useState(emptyMachineForm)
  const [lotFormOpen, setLotFormOpen] = useState(false)
  const [lotForm, setLotForm] = useState({
    productId: '', warehouseId: '', lotNumber: '', initialWeightKg: '', coneCount: '', coneWeightGrams: '', color: '', yarnCount: '', denier: '',
  })
  const [operation, setOperation] = useState<{
    kind: 'start' | 'progress' | 'stop' | 'complete'
    machine: Machine
  } | null>(null)
  const [operationForm, setOperationForm] = useState({
    productionOrderId: '', operatorEmployeeId: '', yarnLotId: '', loadedConeCount: '', loadedYarnGrams: '', goodQuantity: '', defectiveQuantity: '', scrapQuantity: '', yarnUsedQuantity: '', reason: '', note: '',
  })
  const [finishPending, setFinishPending] = useState<{
    machine: Machine
    values: typeof operationForm
  } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [machineRows, orderRows, employeeRows, lotRows, productRows, warehouseRows] =
        await Promise.all([
          apiGet<Machine[]>('/textile-machines/dashboard'),
          apiGet<OrderOption[]>('/production-orders'),
          apiGet<EmployeeOption[]>('/employees').catch(() => []),
          apiGet<YarnLot[]>('/textile-machines/yarn-lots').catch(() => []),
          apiGet<ProductOption[]>('/products').catch(() => []),
          apiGet<WarehouseOption[]>('/warehouses').catch(() => []),
        ])
      setMachines(machineRows)
      setOrders(orderRows)
      setEmployees(employeeRows.filter((employee) => employee.isActive !== false))
      setLots(lotRows)
      setProducts(productRows)
      setWarehouses(warehouseRows)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('machines.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load])

  const visibleMachines = useMemo(
    () => (filter === 'ALL' ? machines : machines.filter((machine) => machine.status === filter)),
    [filter, machines],
  )

  const openMachineForm = (machine?: Machine) => {
    setEditingMachine(machine ?? null)
    setMachineForm(
      machine
        ? {
            code: machine.code,
            name: machine.name,
            model: machine.model ?? '',
            gauge: machine.gauge == null ? '' : String(machine.gauge),
            workingWidthCm:
              machine.workingWidthCm == null ? '' : String(machine.workingWidthCm),
            feederCount: machine.feederCount == null ? '' : String(machine.feederCount),
            serialNumber: machine.serialNumber ?? '',
            status: machine.status,
            notes: machine.notes ?? '',
          }
        : emptyMachineForm,
    )
    setFormError('')
    setMachineFormOpen(true)
  }

  const openOperation = (kind: NonNullable<typeof operation>['kind'], machine: Machine) => {
    const active = machine.activeOrder
    setOperationForm({
      productionOrderId: active ? String(active.id) : '',
      operatorEmployeeId: active?.operator ? String(active.operator.id) : '',
      yarnLotId: active?.yarnLot ? String(active.yarnLot.id) : '',
      loadedConeCount: '',
      loadedYarnGrams: '',
      goodQuantity:
        kind === 'complete' ? String(Math.max(active?.plannedQuantity ?? 0, active?.goodQuantity ?? 0)) : '',
      defectiveQuantity: kind === 'complete' ? String(active?.defectiveQuantity ?? 0) : '',
      scrapQuantity: kind === 'complete' ? String(active?.scrapQuantity ?? 0) : '',
      yarnUsedQuantity: kind === 'complete' ? String(active?.yarnUsedQuantity ?? 0) : '',
      reason: '',
      note: '',
    })
    setFormError('')
    setOperation({ kind, machine })
  }

  const numberOrUndefined = (value: string) => (value === '' ? undefined : Number(value))

  const saveMachine = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    setSaving(true)
    setFormError('')
    const payload = {
      code: machineForm.code,
      name: machineForm.name,
      model: machineForm.model || undefined,
      gauge: numberOrUndefined(machineForm.gauge),
      workingWidthCm: numberOrUndefined(machineForm.workingWidthCm),
      feederCount: numberOrUndefined(machineForm.feederCount),
      serialNumber: machineForm.serialNumber || undefined,
      status: machineForm.status,
      notes: machineForm.notes || undefined,
    }
    try {
      if (editingMachine) await apiPatch(`/textile-machines/${editingMachine.id}`, payload)
      else await apiPost('/textile-machines', payload)
      setMachineFormOpen(false)
      await load()
      setSuccess(t(editingMachine ? 'machines.updated' : 'machines.created'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('machines.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const saveLot = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite || saving) return
    setSaving(true)
    setFormError('')
    try {
      await apiPost('/textile-machines/yarn-lots', {
        productId: Number(lotForm.productId),
        warehouseId: Number(lotForm.warehouseId),
        lotNumber: lotForm.lotNumber,
        initialWeightKg: Number(lotForm.initialWeightKg),
        coneCount: numberOrUndefined(lotForm.coneCount),
        coneWeightGrams: numberOrUndefined(lotForm.coneWeightGrams),
        color: lotForm.color || undefined,
        yarnCount: lotForm.yarnCount || undefined,
        denier: numberOrUndefined(lotForm.denier),
      })
      setLotFormOpen(false)
      await load()
      setSuccess(t('machines.lotCreated'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('machines.lotSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const runOperation = async (event: FormEvent) => {
    event.preventDefault()
    if (!operation || !canWrite || saving) return
    if (operation.kind === 'complete') {
      setFinishPending({ machine: operation.machine, values: operationForm })
      setOperation(null)
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (operation.kind === 'start') {
        await apiPost(`/textile-machines/${operation.machine.id}/start`, {
          productionOrderId: Number(operationForm.productionOrderId),
          operatorEmployeeId: Number(operationForm.operatorEmployeeId),
          yarnLotId: numberOrUndefined(operationForm.yarnLotId),
          loadedConeCount: numberOrUndefined(operationForm.loadedConeCount),
          loadedYarnGrams: numberOrUndefined(operationForm.loadedYarnGrams),
          note: operationForm.note || undefined,
        })
      } else if (operation.kind === 'stop') {
        await apiPost(`/textile-machines/${operation.machine.id}/stop`, {
          productionOrderId: Number(operationForm.productionOrderId),
          reason: operationForm.reason,
          note: operationForm.note || undefined,
        })
      } else {
        await apiPost(`/textile-machines/${operation.machine.id}/progress`, {
          productionOrderId: Number(operationForm.productionOrderId),
          goodQuantity: numberOrUndefined(operationForm.goodQuantity),
          defectiveQuantity: numberOrUndefined(operationForm.defectiveQuantity),
          scrapQuantity: numberOrUndefined(operationForm.scrapQuantity),
          yarnUsedQuantity: numberOrUndefined(operationForm.yarnUsedQuantity),
          note: operationForm.note || undefined,
        })
      }
      setOperation(null)
      await load()
      setSuccess(t('machines.operationSaved'))
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('machines.operationError'))
    } finally {
      setSaving(false)
    }
  }

  const completeProduction = async () => {
    if (!finishPending || saving) return
    setSaving(true)
    setError('')
    try {
      const { machine, values } = finishPending
      await apiPost(`/production-orders/${machine.activeOrder?.id}/complete`, {
        goodQuantity: Number(values.goodQuantity),
        defectiveQuantity: Number(values.defectiveQuantity || 0),
        scrapQuantity: Number(values.scrapQuantity || 0),
        yarnUsedQuantity: Number(values.yarnUsedQuantity || 0),
        idempotencyKey: `MACHINE:${machine.id}:ORDER:${machine.activeOrder?.id}:COMPLETE`,
      })
      setFinishPending(null)
      await load()
      setSuccess(t('machines.completed'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('machines.completeError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={success} onDismiss={() => setSuccess('')} />
      <section className="panel panel--full machine-board">
        <div className="panel__header machine-board__header">
          <div>
            <h2>{t('machines.title')}</h2>
            <p className="panel__meta">{t('machines.description')}</p>
          </div>
          {canWrite && (
            <div className="form-actions">
              <button type="button" className="btn btn--ghost" onClick={() => setLotFormOpen(true)}>
                + {t('machines.newLot')}
              </button>
              <button type="button" className="btn btn--primary" onClick={() => openMachineForm()}>
                + {t('machines.new')}
              </button>
            </div>
          )}
        </div>
        <div className="machine-filters" aria-label={t('machines.filters')}>
          {FILTERS.map((value) => (
            <button
              type="button"
              key={value}
              className={filter === value ? 'machine-filter machine-filter--active' : 'machine-filter'}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {t(`machines.filter.${value}`)}
            </button>
          ))}
        </div>
        {error && <p className="demo-notice" role="alert">{error}</p>}
        <div className="machine-grid">
          {visibleMachines.map((machine) => {
            const order = machine.activeOrder
            return (
              <article className="machine-card" key={machine.id}>
                <header className="machine-card__header">
                  <div>
                    <div className="machine-card__code">{machine.code}</div>
                    <h3>{machine.name}</h3>
                    <p>{[machine.model, machine.gauge ? `${machine.gauge}G` : null].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <span className={`machine-state machine-state--${machine.status.toLowerCase()}`}>
                    <span aria-hidden="true" />{t(`machines.status.${machine.status}`)}
                  </span>
                </header>
                {order ? (
                  <div className="machine-card__body">
                    <div className="machine-card__order"><strong>{order.orderNumber}</strong><span>{order.productName}</span></div>
                    <div className="machine-progress"><div style={{ width: `${order.progress}%` }} /></div>
                    <div className="machine-kpis">
                      <div><span>{t('machines.good')}</span><strong>{formatNumber(order.goodQuantity)}</strong></div>
                      <div><span>{t('machines.defective')}</span><strong>{formatNumber(order.defectiveQuantity)}</strong></div>
                      <div><span>{t('machines.efficiency')}</span><strong>%{formatNumber(order.efficiency)}</strong></div>
                    </div>
                    <p className="machine-card__meta">{t('machines.operator')}: {order.operator?.name ?? '—'} · {t('machines.lot')}: {order.yarnLot?.lotNumber ?? '—'}</p>
                    {order.downtimeReason && <p className="machine-card__warning">{order.downtimeReason}</p>}
                  </div>
                ) : (
                  <div className="machine-card__empty">{t('machines.noActiveOrder')}</div>
                )}
                {canWrite && (
                  <footer className="machine-card__actions">
                    {machine.status === 'AVAILABLE' && !order && <button type="button" className="btn btn--primary" onClick={() => openOperation('start', machine)}>{t('machines.start')}</button>}
                    {machine.status === 'STOPPED' && order && <button type="button" className="btn btn--primary" onClick={() => openOperation('start', machine)}>{t('machines.resume')}</button>}
                    {order && <button type="button" className="btn btn--ghost" onClick={() => openOperation('progress', machine)}>{t('machines.record')}</button>}
                    {machine.status === 'RUNNING' && order && <button type="button" className="btn btn--ghost" onClick={() => openOperation('stop', machine)}>{t('machines.stop')}</button>}
                    {order && <button type="button" className="btn btn--ghost" onClick={() => openOperation('complete', machine)}>{t('machines.complete')}</button>}
                    <button type="button" className="btn btn--ghost" onClick={() => openMachineForm(machine)}>{t('production.edit')}</button>
                  </footer>
                )}
              </article>
            )
          })}
          {!loading && visibleMachines.length === 0 && <div className="machine-empty">{t('machines.empty')}</div>}
        </div>
      </section>

      <Modal open={machineFormOpen} title={editingMachine ? t('machines.editTitle') : t('machines.newTitle')} onClose={() => setMachineFormOpen(false)}>
        <form className="demo-form machine-form" onSubmit={(event) => void saveMachine(event)}>
          {formError && <p className="demo-notice" role="alert">{formError}</p>}
          <label>{t('machines.code')}<input required value={machineForm.code} onChange={(event) => setMachineForm((value) => ({ ...value, code: event.target.value }))} /></label>
          <label>{t('machines.name')}<input required value={machineForm.name} onChange={(event) => setMachineForm((value) => ({ ...value, name: event.target.value }))} /></label>
          <label>{t('machines.model')}<input value={machineForm.model} onChange={(event) => setMachineForm((value) => ({ ...value, model: event.target.value }))} /></label>
          <div className="machine-form__row">
            <label>{t('machines.gauge')}<input type="number" min="1" value={machineForm.gauge} onChange={(event) => setMachineForm((value) => ({ ...value, gauge: event.target.value }))} /></label>
            <label>{t('machines.width')}<input type="number" min="0.01" step="0.01" value={machineForm.workingWidthCm} onChange={(event) => setMachineForm((value) => ({ ...value, workingWidthCm: event.target.value }))} /></label>
            <label>{t('machines.feeders')}<input type="number" min="1" value={machineForm.feederCount} onChange={(event) => setMachineForm((value) => ({ ...value, feederCount: event.target.value }))} /></label>
          </div>
          <label>{t('machines.serial')}<input value={machineForm.serialNumber} onChange={(event) => setMachineForm((value) => ({ ...value, serialNumber: event.target.value }))} /></label>
          <label>{t('production.status')}<select value={machineForm.status} onChange={(event) => setMachineForm((value) => ({ ...value, status: event.target.value as MachineStatus }))}>{FILTERS.slice(1).map((value) => <option key={value} value={value}>{t(`machines.status.${value}`)}</option>)}</select></label>
          <label>{t('production.note')}<textarea rows={2} value={machineForm.notes} onChange={(event) => setMachineForm((value) => ({ ...value, notes: event.target.value }))} /></label>
          <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={() => setMachineFormOpen(false)}>{t('common.cancel')}</button><button type="submit" className="btn btn--primary" disabled={saving}>{t('common.save')}</button></div>
        </form>
      </Modal>

      <Modal open={lotFormOpen} title={t('machines.newLotTitle')} onClose={() => setLotFormOpen(false)}>
        <form className="demo-form machine-form" onSubmit={(event) => void saveLot(event)}>
          {formError && <p className="demo-notice" role="alert">{formError}</p>}
          <label>{t('machines.yarnProduct')}<select required value={lotForm.productId} onChange={(event) => setLotForm((value) => ({ ...value, productId: event.target.value }))}><option value="">{t('production.select')}</option>{products.filter((product) => product.unit === 'KILOGRAM').map((product) => <option key={product.id} value={product.id}>{product.code} · {product.name}</option>)}</select></label>
          <label>{t('machines.warehouse')}<select required value={lotForm.warehouseId} onChange={(event) => setLotForm((value) => ({ ...value, warehouseId: event.target.value }))}><option value="">{t('production.select')}</option>{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} · {warehouse.name}</option>)}</select></label>
          <label>{t('machines.lotNumber')}<input required value={lotForm.lotNumber} onChange={(event) => setLotForm((value) => ({ ...value, lotNumber: event.target.value }))} /></label>
          <div className="machine-form__row"><label>{t('machines.weightKg')}<input required type="number" min="0.001" step="0.001" value={lotForm.initialWeightKg} onChange={(event) => setLotForm((value) => ({ ...value, initialWeightKg: event.target.value }))} /></label><label>{t('machines.cones')}<input type="number" min="0" value={lotForm.coneCount} onChange={(event) => setLotForm((value) => ({ ...value, coneCount: event.target.value }))} /></label><label>{t('machines.coneGrams')}<input type="number" min="0" step="0.001" value={lotForm.coneWeightGrams} onChange={(event) => setLotForm((value) => ({ ...value, coneWeightGrams: event.target.value }))} /></label></div>
          <label>{t('machines.color')}<input value={lotForm.color} onChange={(event) => setLotForm((value) => ({ ...value, color: event.target.value }))} /></label>
          <div className="machine-form__row"><label>{t('machines.yarnCount')}<input value={lotForm.yarnCount} onChange={(event) => setLotForm((value) => ({ ...value, yarnCount: event.target.value }))} /></label><label>{t('machines.denier')}<input type="number" min="1" value={lotForm.denier} onChange={(event) => setLotForm((value) => ({ ...value, denier: event.target.value }))} /></label></div>
          <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={() => setLotFormOpen(false)}>{t('common.cancel')}</button><button type="submit" className="btn btn--primary" disabled={saving}>{t('common.save')}</button></div>
        </form>
      </Modal>

      <Modal open={operation != null} title={operation ? t(`machines.${operation.kind}Title`, { code: operation.machine.code }) : ''} onClose={() => setOperation(null)}>
        {operation && <form className="demo-form machine-form" onSubmit={(event) => void runOperation(event)}>
          {formError && <p className="demo-notice" role="alert">{formError}</p>}
          {operation.kind === 'start' && <><label>{t('machines.order')}<select required disabled={Boolean(operation.machine.activeOrder)} value={operationForm.productionOrderId} onChange={(event) => setOperationForm((value) => ({ ...value, productionOrderId: event.target.value }))}><option value="">{t('production.select')}</option>{orders.filter((order) => order.status === 'PLANNED' || order.id === operation.machine.activeOrder?.id).map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.productName}</option>)}</select></label><label>{t('machines.operator')}<select required value={operationForm.operatorEmployeeId} onChange={(event) => setOperationForm((value) => ({ ...value, operatorEmployeeId: event.target.value }))}><option value="">{t('production.select')}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label><label>{t('machines.lot')}<select value={operationForm.yarnLotId} onChange={(event) => setOperationForm((value) => ({ ...value, yarnLotId: event.target.value }))}><option value="">{t('machines.noLot')}</option>{lots.filter((lot) => lot.remainingWeightKg > 0).map((lot) => <option key={lot.id} value={lot.id}>{lot.lotNumber} · {lot.productName} · {formatNumber(lot.remainingWeightKg)} kg</option>)}</select></label><div className="machine-form__row"><label>{t('machines.loadedCones')}<input type="number" min="0" value={operationForm.loadedConeCount} onChange={(event) => setOperationForm((value) => ({ ...value, loadedConeCount: event.target.value }))} /></label><label>{t('machines.loadedGrams')}<input type="number" min="0" step="0.001" value={operationForm.loadedYarnGrams} onChange={(event) => setOperationForm((value) => ({ ...value, loadedYarnGrams: event.target.value }))} /></label></div></>}
          {(operation.kind === 'progress' || operation.kind === 'complete') && <div className="machine-form__row"><label>{t('machines.good')}<input required={operation.kind === 'complete'} type="number" min="0" step="0.001" value={operationForm.goodQuantity} onChange={(event) => setOperationForm((value) => ({ ...value, goodQuantity: event.target.value }))} /></label><label>{t('machines.defective')}<input type="number" min="0" step="0.001" value={operationForm.defectiveQuantity} onChange={(event) => setOperationForm((value) => ({ ...value, defectiveQuantity: event.target.value }))} /></label><label>{t('machines.scrap')}<input type="number" min="0" step="0.001" value={operationForm.scrapQuantity} onChange={(event) => setOperationForm((value) => ({ ...value, scrapQuantity: event.target.value }))} /></label><label>{t('machines.yarnUsed')}<input type="number" min="0" step="0.001" value={operationForm.yarnUsedQuantity} onChange={(event) => setOperationForm((value) => ({ ...value, yarnUsedQuantity: event.target.value }))} /></label></div>}
          {operation.kind === 'stop' && <label>{t('machines.stopReason')}<input required value={operationForm.reason} onChange={(event) => setOperationForm((value) => ({ ...value, reason: event.target.value }))} /></label>}
          {operation.kind !== 'complete' && <label>{t('production.note')}<textarea rows={2} value={operationForm.note} onChange={(event) => setOperationForm((value) => ({ ...value, note: event.target.value }))} /></label>}
          <div className="form-actions"><button type="button" className="btn btn--ghost" onClick={() => setOperation(null)}>{t('common.cancel')}</button><button type="submit" className="btn btn--primary" disabled={saving}>{operation.kind === 'complete' ? t('machines.reviewComplete') : t('common.save')}</button></div>
        </form>}
      </Modal>

      <ConfirmDialog open={finishPending != null} title={t('machines.confirmTitle')} message={finishPending ? t('machines.confirmMessage', { order: finishPending.machine.activeOrder?.orderNumber ?? '' }) : ''} confirmLabel={t('machines.complete')} onCancel={() => setFinishPending(null)} onConfirm={() => void completeProduction()} />
    </>
  )
}
