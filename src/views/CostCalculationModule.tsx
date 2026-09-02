import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../data/api'
import { computeConeDemandLive } from '../data/costMath'
import { useI18n } from '../i18n/I18nProvider'

type CostCalculation = {
  id: number
  yarnName: string
  yarnType: string
  yarnColor: string | null
  productName: string
  bobbinCount: number
  bobbinGrams: number
  conePrice: number
  totalYarnCost: number
  totalYarnGrams: number
  productWeightGram: number
  productionQuantity: number
  maxProductionQuantity: number
  costPerGram: number
  yarnCostPerUnit: number
  totalCostPerUnit: number
  totalProductionCost: number
  salePrice: number | null
  suggestedSalePrice: number
  totalSaleAmount: number
  netProfit: number | null
  profitMargin: number
  laborCost: number
  electricityCost: number
  packagingCost: number
  otherCost: number
  requiredConeCount?: number
  remainingYarnGrams?: number
  consumedYarnCost?: number
  purchaseCost?: number
  exactConeRequirement?: number
  veloraSuggestion?: string
  createdAt: string
}

type FormState = {
  yarnColor: string
  bobbinGrams: string
  conePrice: string
  productWeightGram: string
  productionQuantity: string
  salePrice: string
  laborCost: string
  electricityCost: string
  packagingCost: string
  otherCost: string
  productName: string
  yarnType: string
  yarnName: string
}

const EXAMPLE_FORM: FormState = {
  yarnColor: '',
  bobbinGrams: '2500',
  conePrice: '300',
  productWeightGram: '420',
  productionQuantity: '100',
  salePrice: '',
  laborCost: '0',
  electricityCost: '0',
  packagingCost: '0',
  otherCost: '0',
  productName: '',
  yarnType: '',
  yarnName: '30/1',
}

const EMPTY_FORM: FormState = { ...EXAMPLE_FORM }

function parseNum(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

export function CostCalculationModule({ canWrite = false }: { canWrite?: boolean }) {
  const { locale, t, formatDate, formatNumber } = useI18n()
  const formatDzd = useCallback(
    (value: number, fractionDigits = 2) =>
      `${formatNumber(value, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      })} DZD`,
    [formatNumber],
  )
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [rows, setRows] = useState<CostCalculation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CostCalculation | null>(null)
  const [editing, setEditing] = useState<CostCalculation | null>(null)

  const live = useMemo(() => {
    const saleRaw = form.salePrice.trim()
    return computeConeDemandLive({
      coneWeightGrams: parseNum(form.bobbinGrams),
      conePrice: parseNum(form.conePrice),
      yarnUsageGramsPerUnit: parseNum(form.productWeightGram),
      quantity: Math.trunc(parseNum(form.productionQuantity)),
      yarnColor: form.yarnColor,
      laborCost: parseNum(form.laborCost || '0'),
      electricityCost: parseNum(form.electricityCost || '0'),
      packagingCost: parseNum(form.packagingCost || '0'),
      otherCost: parseNum(form.otherCost || '0'),
      salePrice: saleRaw === '' ? null : parseNum(saleRaw),
    })
  }, [form])

  const openEdit = (row: CostCalculation) => {
    setEditing(row)
    setFormError('')
    setForm({
      yarnColor: row.yarnColor ?? '',
      bobbinGrams: String(row.bobbinGrams),
      conePrice: String(row.conePrice ?? (row.bobbinCount > 0 ? row.totalYarnCost / row.bobbinCount : 0)),
      productWeightGram: String(row.productWeightGram),
      productionQuantity: String(row.productionQuantity),
      salePrice: row.salePrice != null ? String(row.salePrice) : '',
      laborCost: String(row.laborCost ?? 0),
      electricityCost: String(row.electricityCost ?? 0),
      packagingCost: String(row.packagingCost ?? 0),
      otherCost: String(row.otherCost ?? 0),
      productName: row.productName ?? '',
      yarnType: row.yarnType ?? '',
      yarnName: row.yarnName ?? '',
    })
  }

  const cancelEdit = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setFormError('')
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<CostCalculation[]>('/cost-calculations')
      setRows(data)
      setError('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('cost.loadError'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase(locale)
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.productName.toLocaleLowerCase(locale).includes(q) ||
        row.yarnName.toLocaleLowerCase(locale).includes(q) ||
        row.yarnType.toLocaleLowerCase(locale).includes(q) ||
        (row.yarnColor?.toLocaleLowerCase(locale).includes(q) ?? false),
    )
  }, [locale, rows, search])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite) return
    setFormError('')

    if (!live) {
      setFormError(t('cost.invalidNumbers'))
      return
    }

    setSaving(true)
    try {
      const saleRaw = form.salePrice.trim()
      const payload = {
        conePrice: parseNum(form.conePrice),
        bobbinGrams: parseNum(form.bobbinGrams),
        coneWeightGrams: parseNum(form.bobbinGrams),
        productWeightGram: parseNum(form.productWeightGram),
        yarnUsageGramsPerUnit: parseNum(form.productWeightGram),
        productionQuantity: Math.trunc(parseNum(form.productionQuantity)),
        quantity: Math.trunc(parseNum(form.productionQuantity)),
        yarnColor: form.yarnColor.trim() || undefined,
        salePrice: saleRaw === '' ? undefined : parseNum(saleRaw),
        laborCost: parseNum(form.laborCost || '0'),
        electricityCost: parseNum(form.electricityCost || '0'),
        packagingCost: parseNum(form.packagingCost || '0'),
        otherCost: parseNum(form.otherCost || '0'),
        productName: form.productName.trim() || undefined,
        yarnType: form.yarnType.trim() || undefined,
        yarnName: form.yarnName.trim() || undefined,
      }
      if (editing) {
        await apiPatch<CostCalculation>(`/cost-calculations/${editing.id}`, payload)
        setSuccessNotice(t('cost.updated'))
      } else {
        await apiPost<CostCalculation>('/cost-calculations', payload)
        setSuccessNotice(t('cost.saved'))
      }
      setEditing(null)
      setForm({ ...EMPTY_FORM })
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : t('cost.saveError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !canWrite) return
    setSaving(true)
    try {
      await apiDelete(`/cost-calculations/${deleteTarget.id}`)
      setSuccessNotice(t('cost.deleted'))
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('cost.deleteError'))
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <SuccessToast message={successNotice} onDismiss={() => setSuccessNotice('')} />

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('cost.title')}</h2>
          <span className="panel__meta">{t('cost.meta')}</span>
        </div>

        <div className="cost-layout">
          <form className="cost-main" onSubmit={(e) => void handleSave(e)}>
            <fieldset className="cost-section">
              <legend>{t('cost.yarnSection')}</legend>
              <div className="cost-form">
                <label>
                  {t('cost.yarnColor')}
                  <input
                    value={form.yarnColor}
                    onChange={(e) => setField('yarnColor', e.target.value)}
                    disabled={!canWrite}
                    placeholder={t('cost.optional')}
                  />
                </label>
                <label>
                  {t('cost.bobbinGrams')}
                  <input
                    type="number"
                    min={0.0001}
                    step="0.01"
                    dir="ltr"
                    value={form.bobbinGrams}
                    onChange={(e) => setField('bobbinGrams', e.target.value)}
                    disabled={!canWrite}
                    required
                  />
                </label>
                <label>
                  {t('cost.conePrice')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    value={form.conePrice}
                    onChange={(e) => setField('conePrice', e.target.value)}
                    disabled={!canWrite}
                    required
                  />
                </label>
                <label>
                  {t('cost.yarnType')}
                  <input
                    value={form.yarnType}
                    onChange={(e) => setField('yarnType', e.target.value)}
                    disabled={!canWrite}
                    placeholder={t('cost.optional')}
                  />
                </label>
                <label>
                  {t('cost.yarnNumber')}
                  <input
                    value={form.yarnName}
                    onChange={(e) => setField('yarnName', e.target.value)}
                    disabled={!canWrite}
                    placeholder={t('cost.optional')}
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="cost-section">
              <legend>{t('cost.productSection')}</legend>
              <div className="cost-form">
                <label>
                  {t('cost.productName')}
                  <input
                    value={form.productName}
                    onChange={(e) => setField('productName', e.target.value)}
                    disabled={!canWrite}
                    placeholder={t('cost.optional')}
                  />
                </label>
                <label>
                  {t('cost.productGrams')}
                  <input
                    type="number"
                    min={0.0001}
                    step="0.01"
                    dir="ltr"
                    value={form.productWeightGram}
                    onChange={(e) => setField('productWeightGram', e.target.value)}
                    disabled={!canWrite}
                    required
                  />
                </label>
                <label>
                  {t('cost.productionQuantity')}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    dir="ltr"
                    value={form.productionQuantity}
                    onChange={(e) => setField('productionQuantity', e.target.value)}
                    disabled={!canWrite}
                    required
                  />
                </label>
                <label>
                  {t('cost.salePrice')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    value={form.salePrice}
                    onChange={(e) => setField('salePrice', e.target.value)}
                    disabled={!canWrite}
                    placeholder="What-if P&L"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="cost-section">
              <legend>{t('cost.extraSection')}</legend>
              <div className="cost-form">
                <label>
                  {t('cost.labor')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    value={form.laborCost}
                    onChange={(e) => setField('laborCost', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label>
                  {t('cost.electricity')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    value={form.electricityCost}
                    onChange={(e) => setField('electricityCost', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label>
                  {t('cost.packaging')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    value={form.packagingCost}
                    onChange={(e) => setField('packagingCost', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
                <label>
                  {t('cost.other')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    value={form.otherCost}
                    onChange={(e) => setField('otherCost', e.target.value)}
                    disabled={!canWrite}
                  />
                </label>
              </div>
            </fieldset>

            {editing && (
              <p className="panel__meta" style={{ marginBottom: 8 }}>
                {t('cost.editing', { name: editing.productName || t('cost.calculation') })}
              </p>
            )}

            {formError && (
              <p className="demo-notice" role="alert">
                {formError}
              </p>
            )}

            {canWrite && (
              <div className="form-actions">
                {editing ? (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={cancelEdit}
                    disabled={saving}
                  >
                    {t('cost.cancelEdit')}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={() =>
                      setForm({
                        ...EXAMPLE_FORM,
                        productName: t('cost.exampleProduct'),
                        yarnType: t('cost.exampleYarn'),
                        yarnColor: t('cost.exampleColor'),
                      })
                    }
                    disabled={saving}
                  >
                    {t('cost.example')}
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || !live}
                >
                  {saving
                    ? t('cost.saving')
                    : editing
                      ? t('cost.saveChanges')
                      : t('cost.saveQuote')}
                </button>
              </div>
            )}
          </form>

          <aside className="cost-summary" aria-live="polite">
            <h3>{t('cost.summary')}</h3>
            <dl>
              <div>
                <dt>{t('cost.result.color')}</dt>
                <dd>{live?.yarnColor || '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.result.pricePerGram')}</dt>
                <dd>{live ? formatDzd(live.pricePerGram, 4) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.result.usagePerUnit')}</dt>
                <dd>
                  {live
                    ? `${formatNumber(live.yarnUsageGramsPerUnit, { maximumFractionDigits: 2 })} g`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('cost.result.yarnCostPerUnit')}</dt>
                <dd>{live ? formatDzd(live.yarnCostPerUnit) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.result.totalYarn')}</dt>
                <dd>
                  {live
                    ? `${formatNumber(live.totalYarnGrams, { maximumFractionDigits: 0 })} g (${formatNumber(live.totalYarnKilograms, { maximumFractionDigits: 3 })} kg)`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('cost.result.exactCones')}</dt>
                <dd>
                  {live
                    ? formatNumber(live.exactConeRequirement, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 2,
                      })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('cost.result.requiredCones')}</dt>
                <dd>{live ? formatNumber(live.requiredConeCount) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.result.consumedCost')}</dt>
                <dd>{live ? formatDzd(live.consumedYarnCost) : '—'}</dd>
              </div>
              <div className="cost-summary__highlight">
                <dt>{t('cost.result.purchaseCost')}</dt>
                <dd>{live ? formatDzd(live.purchaseCost) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.result.remaining')}</dt>
                <dd>
                  {live
                    ? `${formatNumber(live.remainingYarnGrams, { maximumFractionDigits: 0 })} g`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('cost.result.unitCost')}</dt>
                <dd>{live ? formatDzd(live.totalCostPerUnit) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.totalRevenue')}</dt>
                <dd>
                  {live?.totalSaleAmount != null ? formatDzd(live.totalSaleAmount) : '—'}
                </dd>
              </div>
              <div className="cost-summary__highlight">
                <dt>{t('cost.netProfit')}</dt>
                <dd>{live?.netProfit != null ? formatDzd(live.netProfit) : '—'}</dd>
              </div>
            </dl>

            {live && (
              <>
                <h4 className="cost-summary__sub">{t('cost.priceSuggestions')}</h4>
                <table className="cost-profit-table">
                  <thead>
                    <tr>
                      <th>{t('cost.profit')}</th>
                      <th>{t('cost.price')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {live.profitOptions.map((opt) => (
                      <tr
                        key={opt.marginPercent}
                        className={
                          opt.marginPercent === 100
                            ? 'cost-profit-table__default'
                            : undefined
                        }
                      >
                        <td>%{opt.marginPercent}</td>
                        <td dir="ltr">{formatDzd(opt.salePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="cost-summary__note cost-summary__note--emphasis">
                  {t('cost.suggestion', { price: formatDzd(live.suggestedSalePrice) })}
                </p>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>{t('cost.history')}</h2>
          <span className="panel__meta">
            {loading ? t('common.loading') : t('cost.recordCount', { count: filtered.length })}
          </span>
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('cost.search')}
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
                <th>{t('cost.date')}</th>
                <th>{t('cost.product')}</th>
                <th>{t('cost.yarnColor')}</th>
                <th>{t('cost.bobbin')}</th>
                <th>{t('cost.units')}</th>
                <th>{t('cost.unitCost')}</th>
                <th>{t('cost.suggestedSale')}</th>
                <th>{t('cost.saleProfit')}</th>
                {canWrite && <th>{t('cost.action')}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 9 : 8} className="empty-cell">
                    {loading ? t('common.loading') : t('cost.empty')}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="date-cell">
                      {formatDate(row.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>{row.productName || '—'}</td>
                    <td>{row.yarnColor || '—'}</td>
                    <td dir="ltr">
                      {row.bobbinCount}×{row.bobbinGrams}g
                    </td>
                    <td dir="ltr">{formatNumber(row.productionQuantity)}</td>
                    <td className="amount-cell">{formatDzd(row.totalCostPerUnit)}</td>
                    <td className="amount-cell">{formatDzd(row.suggestedSalePrice)}</td>
                    <td className="amount-cell">
                      {row.salePrice != null
                        ? `${formatDzd(row.salePrice)} / ${
                            row.netProfit != null ? formatDzd(row.netProfit) : '—'
                          }`
                        : '—'}
                    </td>
                    {canWrite && (
                      <td>
                        <div className="form-actions" style={{ justifyContent: 'flex-start' }}>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() => openEdit(row)}
                          >
                            {t('cost.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost"
                            disabled={saving}
                            onClick={() => setDeleteTarget(row)}
                          >
                            {t('cost.delete')}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('cost.deleteTitle')}
        message={
          deleteTarget
            ? t('cost.deleteMessage', {
                name: deleteTarget.productName || t('cost.calculation'),
              })
            : ''
        }
        confirmLabel={t('cost.delete')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
