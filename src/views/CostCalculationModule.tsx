import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPost } from '../data/api'
import { useI18n } from '../i18n/I18nProvider'

type CostCalculation = {
  id: number
  yarnName: string
  yarnType: string
  productName: string
  bobbinCount: number
  bobbinGrams: number
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
  veloraSuggestion?: string
  createdAt: string
}

type FormState = {
  bobbinCount: string
  bobbinGrams: string
  totalYarnCost: string
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
  bobbinCount: '12',
  bobbinGrams: '200',
  totalYarnCost: '480',
  productWeightGram: '15',
  productionQuantity: '100',
  salePrice: '100',
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

function round(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function computeLive(form: FormState) {
  const bobbinCount = parseNum(form.bobbinCount)
  const bobbinGrams = parseNum(form.bobbinGrams)
  const totalYarnCost = parseNum(form.totalYarnCost)
  const productWeightGram = parseNum(form.productWeightGram)
  const productionQuantity = parseNum(form.productionQuantity)
  const laborCost = parseNum(form.laborCost || '0')
  const electricityCost = parseNum(form.electricityCost || '0')
  const packagingCost = parseNum(form.packagingCost || '0')
  const otherCost = parseNum(form.otherCost || '0')
  const saleRaw = form.salePrice.trim()
  const salePrice = saleRaw === '' ? null : parseNum(saleRaw)

  if (
    [bobbinCount, bobbinGrams, totalYarnCost, productWeightGram, productionQuantity].some(
      (n) => Number.isNaN(n),
    ) ||
    bobbinCount < 1 ||
    bobbinGrams <= 0 ||
    totalYarnCost < 0 ||
    productWeightGram <= 0 ||
    productionQuantity < 1 ||
    [laborCost, electricityCost, packagingCost, otherCost].some((n) => Number.isNaN(n) || n < 0) ||
    (salePrice != null && (Number.isNaN(salePrice) || salePrice < 0))
  ) {
    return null
  }

  const totalYarnGrams = Math.round(bobbinCount * bobbinGrams)
  const totalYarnKg = round(totalYarnGrams / 1000, 4)
  const costPerGram = round(totalYarnCost / totalYarnGrams, 4)
  const yarnCostPerUnit = round(productWeightGram * costPerGram, 2)
  const extrasPerUnit = round(
    laborCost + electricityCost + packagingCost + otherCost,
    2,
  )
  const totalCostPerUnit = round(yarnCostPerUnit + extrasPerUnit, 2)
  const maxProductionQuantity = Math.floor(totalYarnGrams / productWeightGram)
  const qty = Math.trunc(productionQuantity)
  const totalProductionCost = round(qty * totalCostPerUnit, 2)
  const suggestedSalePrice = round(totalCostPerUnit * 2, 2)
  const profitOptions = [
    { marginPercent: 30, salePrice: round(totalCostPerUnit * 1.3, 2) },
    { marginPercent: 50, salePrice: round(totalCostPerUnit * 1.5, 2) },
    { marginPercent: 100, salePrice: round(totalCostPerUnit * 2, 2) },
    { marginPercent: 200, salePrice: round(totalCostPerUnit * 3, 2) },
  ]

  let totalSaleAmount: number | null = null
  let netProfit: number | null = null
  let profitMarginPercent: number | null = null
  if (salePrice != null) {
    totalSaleAmount = round(qty * salePrice, 2)
    netProfit = round(totalSaleAmount - totalProductionCost, 2)
    profitMarginPercent =
      totalSaleAmount > 0 ? round((netProfit / totalSaleAmount) * 100, 2) : 0
  }

  return {
    totalYarnGrams,
    totalYarnKg,
    costPerGram,
    yarnCostPerUnit,
    totalCostPerUnit,
    maxProductionQuantity,
    productionQuantity: qty,
    totalProductionCost,
    salePrice,
    totalSaleAmount,
    netProfit,
    profitMarginPercent,
    suggestedSalePrice,
    profitOptions,
  }
}

export function CostCalculationModule({ canWrite = false }: { canWrite?: boolean }) {
  const { locale, t, formatDate, formatNumber } = useI18n()
  const formatDzd = useCallback((value: number, fractionDigits = 2) =>
    `${formatNumber(value, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })} DZD`, [formatNumber])
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [rows, setRows] = useState<CostCalculation[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [successNotice, setSuccessNotice] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CostCalculation | null>(null)

  const live = useMemo(() => computeLive(form), [form])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await apiGet<CostCalculation[]>('/cost-calculations')
      setRows(data)
      setError('')
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('cost.loadError'),
      )
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
        row.yarnType.toLocaleLowerCase(locale).includes(q),
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
    if (live.productionQuantity > live.maxProductionQuantity) {
      setFormError(
        t('cost.maxQuantity', { count: live.maxProductionQuantity }),
      )
      return
    }

    setSaving(true)
    try {
      const saleRaw = form.salePrice.trim()
      await apiPost<CostCalculation>('/cost-calculations', {
        bobbinCount: Math.trunc(parseNum(form.bobbinCount)),
        bobbinGrams: parseNum(form.bobbinGrams),
        totalYarnCost: parseNum(form.totalYarnCost),
        productWeightGram: parseNum(form.productWeightGram),
        productionQuantity: Math.trunc(parseNum(form.productionQuantity)),
        salePrice: saleRaw === '' ? undefined : parseNum(saleRaw),
        laborCost: parseNum(form.laborCost || '0'),
        electricityCost: parseNum(form.electricityCost || '0'),
        packagingCost: parseNum(form.packagingCost || '0'),
        otherCost: parseNum(form.otherCost || '0'),
        productName: form.productName.trim() || undefined,
        yarnType: form.yarnType.trim() || undefined,
        yarnName: form.yarnName.trim() || undefined,
      })
      setSuccessNotice(t('cost.saved'))
      await load()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : t('cost.saveError'),
      )
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
                  {t('cost.bobbinCount')}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    dir="ltr"
                    value={form.bobbinCount}
                    onChange={(e) => setField('bobbinCount', e.target.value)}
                    disabled={!canWrite}
                    required
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
                  {t('cost.totalYarnCost')}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    dir="ltr"
                    value={form.totalYarnCost}
                    onChange={(e) => setField('totalYarnCost', e.target.value)}
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

            {formError && (
              <p className="demo-notice" role="alert">
                {formError}
              </p>
            )}

            {canWrite && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setForm({ ...EXAMPLE_FORM, productName: t('cost.exampleProduct'), yarnType: t('cost.exampleYarn') })}
                  disabled={saving}
                >
                  {t('cost.example')}
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || !live}
                >
                  {saving ? t('cost.saving') : t('cost.saveQuote')}
                </button>
              </div>
            )}
          </form>

          <aside className="cost-summary" aria-live="polite">
            <h3>{t('cost.summary')}</h3>
            <dl>
              <div>
                <dt>{t('cost.totalYarn')}</dt>
                <dd>
                  {live
                    ? `${formatNumber(live.totalYarnGrams)} g (${formatNumber(live.totalYarnKg)} kg)`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('cost.gramCost')}</dt>
                <dd>{live ? formatDzd(live.costPerGram, 4) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.unitCost')}</dt>
                <dd>{live ? formatDzd(live.totalCostPerUnit) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.quantity')}</dt>
                <dd>
                  {live
                    ? t('cost.quantityValue', { count: formatNumber(live.productionQuantity), max: formatNumber(live.maxProductionQuantity) })
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>{t('cost.totalCost')}</dt>
                <dd>{live ? formatDzd(live.totalProductionCost) : '—'}</dd>
              </div>
              <div>
                <dt>{t('cost.totalRevenue')}</dt>
                <dd>
                  {live?.totalSaleAmount != null
                    ? formatDzd(live.totalSaleAmount)
                    : '—'}
                </dd>
              </div>
              <div className="cost-summary__highlight">
                <dt>{t('cost.netProfit')}</dt>
                <dd>
                  {live?.netProfit != null ? formatDzd(live.netProfit) : '—'}
                </dd>
              </div>
              <div className="cost-summary__highlight">
                <dt>{t('cost.margin')}</dt>
                <dd>
                  {live?.profitMarginPercent != null
                    ? `%${formatNumber(live.profitMarginPercent, {
                        maximumFractionDigits: 2,
                      })}`
                    : '—'}
                </dd>
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
                  <td colSpan={canWrite ? 8 : 7} className="empty-cell">
                    {loading
                      ? t('common.loading')
                      : t('cost.empty')}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="date-cell">{formatDate(row.createdAt, { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{row.productName || '—'}</td>
                    <td dir="ltr">
                      {row.bobbinCount}×{row.bobbinGrams}g
                    </td>
                    <td dir="ltr">
                      {formatNumber(row.productionQuantity)}
                    </td>
                    <td className="amount-cell">
                      {formatDzd(row.totalCostPerUnit)}
                    </td>
                    <td className="amount-cell">
                      {formatDzd(row.suggestedSalePrice)}
                    </td>
                    <td className="amount-cell">
                      {row.salePrice != null
                        ? `${formatDzd(row.salePrice)} / ${
                            row.netProfit != null ? formatDzd(row.netProfit) : '—'
                          }`
                        : '—'}
                    </td>
                    {canWrite && (
                      <td>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={saving}
                          onClick={() => setDeleteTarget(row)}
                        >
                          {t('cost.delete')}
                        </button>
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
            ? t('cost.deleteMessage', { name: deleteTarget.productName || t('cost.calculation') })
            : ''
        }
        confirmLabel={t('cost.delete')}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
