import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ModuleToolbar } from '../components/ModuleToolbar'
import { SuccessToast } from '../components/Toast'
import { ApiError, apiDelete, apiGet, apiPost } from '../data/api'

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
  productName: 'Örnek ürün',
  yarnType: 'Pamuk',
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

function formatDa(value: number, fractionDigits = 2): string {
  return `${value.toLocaleString('fr-DZ', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} DA`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-DZ', {
    timeZone: 'Africa/Algiers',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatVeloraSaleSuggestion(suggestedSalePrice: number): string {
  const formatted = suggestedSalePrice.toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `VEXOR önerisi: Bu ürün için başlangıç satış fiyatı ${formatted} dinar olabilir.`
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
    veloraSuggestion: formatVeloraSaleSuggestion(suggestedSalePrice),
  }
}

export function CostCalculationModule({ canWrite = false }: { canWrite?: boolean }) {
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

  const load = async () => {
    setLoading(true)
    try {
      const data = await apiGet<CostCalculation[]>('/cost-calculations')
      setRows(data)
      setError('')
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Maliyet hesapları alınamadı.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLocaleLowerCase('tr-TR')
    if (!q) return rows
    return rows.filter(
      (row) =>
        row.productName.toLocaleLowerCase('tr-TR').includes(q) ||
        row.yarnName.toLocaleLowerCase('tr-TR').includes(q) ||
        row.yarnType.toLocaleLowerCase('tr-TR').includes(q),
    )
  }, [rows, search])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canWrite) return
    setFormError('')

    if (!live) {
      setFormError('Sayısal alanları kontrol edin.')
      return
    }
    if (live.productionQuantity > live.maxProductionQuantity) {
      setFormError(
        `Üretim adedi maksimum ${live.maxProductionQuantity} olabilir.`,
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
      setSuccessNotice('Maliyet / teklif kaydı oluşturuldu.')
      await load()
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Maliyet hesabı kaydedilemedi.',
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
      setSuccessNotice('Kayıt silindi.')
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kayıt silinemedi.')
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
          <h2>Maliyet Hesaplama</h2>
          <span className="panel__meta">Para birimi: DA (DZD) · Africa/Algiers</span>
        </div>

        <div className="cost-layout">
          <form className="cost-main" onSubmit={(e) => void handleSave(e)}>
            <fieldset className="cost-section">
              <legend>İplik (bobin)</legend>
              <div className="cost-form">
                <label>
                  Bobin sayısı
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
                  Bobin gramı
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
                  Toplam iplik maliyeti (DA)
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
                  İplik türü
                  <input
                    value={form.yarnType}
                    onChange={(e) => setField('yarnType', e.target.value)}
                    disabled={!canWrite}
                    placeholder="Opsiyonel"
                  />
                </label>
                <label>
                  İplik numarası
                  <input
                    value={form.yarnName}
                    onChange={(e) => setField('yarnName', e.target.value)}
                    disabled={!canWrite}
                    placeholder="Opsiyonel"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset className="cost-section">
              <legend>Ürün ve üretim</legend>
              <div className="cost-form">
                <label>
                  Ürün adı
                  <input
                    value={form.productName}
                    onChange={(e) => setField('productName', e.target.value)}
                    disabled={!canWrite}
                    placeholder="Opsiyonel"
                  />
                </label>
                <label>
                  Ürün gramı
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
                  Üretim adedi
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
                  Satış fiyatı (DA) — opsiyonel
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
              <legend>Ek giderler / birim (opsiyonel)</legend>
              <div className="cost-form">
                <label>
                  İşçilik (DA)
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
                  Elektrik (DA)
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
                  Paketleme (DA)
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
                  Diğer (DA)
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
                  onClick={() => setForm(EXAMPLE_FORM)}
                  disabled={saving}
                >
                  Örnek senaryo
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={saving || !live}
                >
                  {saving ? 'Kaydediliyor…' : 'Teklifi kaydet'}
                </button>
              </div>
            )}
          </form>

          <aside className="cost-summary" aria-live="polite">
            <h3>Maliyet Özeti</h3>
            <dl>
              <div>
                <dt>1. Toplam iplik miktarı</dt>
                <dd>
                  {live
                    ? `${live.totalYarnGrams.toLocaleString('fr-DZ')} g (${live.totalYarnKg.toLocaleString('fr-DZ')} kg)`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>2. Gram maliyeti</dt>
                <dd>{live ? formatDa(live.costPerGram, 4) : '—'}</dd>
              </div>
              <div>
                <dt>3. Ürün başı maliyet</dt>
                <dd>{live ? formatDa(live.totalCostPerUnit) : '—'}</dd>
              </div>
              <div>
                <dt>4. Üretilecek adet</dt>
                <dd>
                  {live
                    ? `${live.productionQuantity.toLocaleString('fr-DZ')} (maks. ${live.maxProductionQuantity.toLocaleString('fr-DZ')})`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>5. Toplam maliyet</dt>
                <dd>{live ? formatDa(live.totalProductionCost) : '—'}</dd>
              </div>
              <div>
                <dt>6. Toplam satış geliri</dt>
                <dd>
                  {live?.totalSaleAmount != null
                    ? formatDa(live.totalSaleAmount)
                    : '—'}
                </dd>
              </div>
              <div className="cost-summary__highlight">
                <dt>7. Net kâr</dt>
                <dd>
                  {live?.netProfit != null ? formatDa(live.netProfit) : '—'}
                </dd>
              </div>
              <div className="cost-summary__highlight">
                <dt>8. Kâr marjı</dt>
                <dd>
                  {live?.profitMarginPercent != null
                    ? `%${live.profitMarginPercent.toLocaleString('fr-DZ', {
                        maximumFractionDigits: 2,
                      })}`
                    : '—'}
                </dd>
              </div>
            </dl>

            {live && (
              <>
                <h4 className="cost-summary__sub">Satış fiyatı önerileri</h4>
                <table className="cost-profit-table">
                  <thead>
                    <tr>
                      <th>Kâr</th>
                      <th>Fiyat</th>
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
                        <td dir="ltr">{formatDa(opt.salePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="cost-summary__note cost-summary__note--emphasis">
                  {live.veloraSuggestion}
                </p>
              </>
            )}
          </aside>
        </div>
      </section>

      <section className="panel panel--full">
        <div className="panel__header">
          <h2>Geçmiş hesaplamalar</h2>
          <span className="panel__meta">
            {loading ? 'Yükleniyor…' : `${filtered.length} kayıt`}
          </span>
        </div>
        <ModuleToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ürün veya iplik ara..."
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
                <th>Tarih</th>
                <th>Ürün</th>
                <th>Bobin</th>
                <th>Adet</th>
                <th>Birim maliyet</th>
                <th>Önerilen satış</th>
                <th>Satış / kâr</th>
                {canWrite && <th>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={canWrite ? 8 : 7} className="empty-cell">
                    {loading
                      ? 'Yükleniyor…'
                      : 'Henüz kayıtlı maliyet hesabı yok.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="date-cell">{formatDate(row.createdAt)}</td>
                    <td>{row.productName || '—'}</td>
                    <td dir="ltr">
                      {row.bobbinCount}×{row.bobbinGrams}g
                    </td>
                    <td dir="ltr">
                      {row.productionQuantity.toLocaleString('fr-DZ')}
                    </td>
                    <td className="amount-cell">
                      {formatDa(row.totalCostPerUnit)}
                    </td>
                    <td className="amount-cell">
                      {formatDa(row.suggestedSalePrice)}
                    </td>
                    <td className="amount-cell">
                      {row.salePrice != null
                        ? `${formatDa(row.salePrice)} / ${
                            row.netProfit != null ? formatDa(row.netProfit) : '—'
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
                          Sil
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
        title="Kaydı sil"
        message={
          deleteTarget
            ? `"${deleteTarget.productName || 'Hesaplama'}" kaydı kalıcı olarak silinecek. Devam?`
            : ''
        }
        confirmLabel="Sil"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
