import { useId, useState } from 'react'
import { AI_COMMAND_LIMIT, AI_LINE_LIMIT, calculateAiQuote, quoteKeys, sumAiQuotes, validateAiField } from '../data/aiCalculation'
import { useI18n } from '../i18n/I18nProvider'
import { aiEntryLabels } from '../i18n/catalogs/aiEntry'
import { loadAiEntryCatalog } from '../data/aiEntryCatalog'
import { Icon } from './Icons'

const newLine = () => ({ id: crypto.randomUUID(), product: '', quantity: '', unit: '', price: '', discount: '0', tax: '0' })
const lineKeys = ['product', 'quantity', 'unit', 'price', 'discount', 'tax'] as const

export function AiEntryAssistant({ disabled, canDraft, onDraft }: { disabled: boolean; canDraft: boolean; onDraft: (text: string) => void }) {
  const { language, formatNumber, formatDate } = useI18n()
  const labels = aiEntryLabels[language ?? 'tr']
  const id = useId()
  const [open, setOpen] = useState(false)
  const [customer, setCustomer] = useState('')
  const [lines, setLines] = useState(() => [newLine()])
  const [catalog, setCatalog] = useState<Awaited<ReturnType<typeof loadAiEntryCatalog>> | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const touch = (field: string) => setTouched((current) => ({ ...current, [field]: true }))
  const loadCatalog = async () => {
    setCatalogLoading(true)
    setCatalogError(false)
    setCatalog(null)
    try {
      setCatalog(await loadAiEntryCatalog())
    } catch {
      setCatalogError(true)
    } finally {
      setCatalogLoading(false)
    }
  }
  const results = lines.map((line) => calculateAiQuote(line.quantity, line.price, line.discount, line.tax))
  const result = sumAiQuotes(results)
  const text = [labels.command, `${labels.customer}: ${customer.trim()}`, ...lines.map((line, index) =>
    `${labels.line} ${index + 1}: ${lineKeys.map((key) => `${labels[key]}: ${line[key].trim()}`).join('; ')}`)].join('\n')
  const tooLong = text.length > AI_COMMAND_LIMIT
  const ready = result && customer.trim() && lines.every((line) => line.product.trim() && line.unit.trim()) && !tooLong
  const format = (value: number) => formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return <div className="ai-entry">
    <button type="button" className="ai-workspace-action" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Icon name="calculator" /><span>{labels.title}</span><span aria-hidden="true">{open ? '−' : '+'}</span></button>
    {open && <div id={id} className="ai-entry__body">
      <p>{labels.help}</p>
      {canDraft && <div className="ai-entry__catalog">
        <button type="button" className="btn btn--ghost" disabled={disabled || catalogLoading} onClick={() => void loadCatalog()}>{catalogLoading ? labels.loading : labels.load}</button>
        {catalogError && <p role="alert">{labels.loadError}</p>}
        {catalog && <p className="ai-entry__hint">{labels.source}: {formatDate(catalog.loadedAt, { dateStyle: 'short', timeStyle: 'short' })}</p>}
        {catalog && !catalog.customers.length && !catalog.products.length && <p role="status">{labels.empty}</p>}
      </div>}
      <fieldset disabled={disabled} className="ai-entry__fields">
        {canDraft && catalog && catalog.customers.length > 0 && <label><span>{labels.customerSelect}</span>
          <select value="" onChange={(event) => {
            const selected = catalog.customers.find((item) => item.id === Number(event.target.value))
            if (selected) setCustomer(`${selected.name} (#${selected.id})`)
          }}><option value="">{labels.choose}</option>{catalog.customers.map((item) => <option key={item.id} value={item.id}>{item.name} (#{item.id})</option>)}</select>
        </label>}
        <div className="ai-entry__field"><label><span>{labels.customer}</span><input value={customer} maxLength={100}
          onBlur={() => touch('customer')} aria-invalid={Boolean(touched.customer && !customer.trim())}
          aria-describedby={touched.customer && !customer.trim() ? `${id}-customer-error` : undefined}
          onChange={(event) => setCustomer(event.target.value)} /></label>
          {touched.customer && !customer.trim() && <small className="ai-entry__error" id={`${id}-customer-error`}>{labels.requiredField}</small>}
        </div>
      </fieldset>
      {lines.map((line, index) => {
        const invalid = !results[index] && Boolean(line.quantity || line.price)
        return <fieldset disabled={disabled} key={line.id} className="ai-entry__line">
          <legend>{labels.line} {index + 1}</legend>
          {canDraft && catalog && catalog.products.length > 0 && <div className="ai-entry__fields"><label><span>{labels.productSelect}</span>
            <select value="" aria-describedby={`${id}-${line.id}-price-hint`} onChange={(event) => {
              const selected = catalog.products.find((item) => item.id === Number(event.target.value))
              if (!selected) return
              const units = { METER: labels.meter, PIECE: labels.piece, KILOGRAM: labels.kilogram }
              setLines((current) => current.map((item) => item.id === line.id ? {
                ...item, product: `${selected.name} (${selected.code})`, unit: units[selected.unit] ?? '',
                price: selected.salePrice == null ? '' : String(selected.salePrice),
              } : item))
            }}><option value="">{labels.choose}</option>{catalog.products.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select>
          </label><small id={`${id}-${line.id}-price-hint`}>{labels.priceHint}</small></div>}
          <div className="ai-entry__fields">
            {lineKeys.map((key) => {
              const fieldId = `${id}-${line.id}-${key}`
              const issue = key === 'product' || key === 'unit' ? (line[key].trim() ? null : 'requiredField') : validateAiField(key, line[key])
              const showIssue = issue && (touched[fieldId] || Boolean(line[key]))
              return <div key={key} className="ai-entry__field"><label>
              <span>{labels[key]}</span>
              <input value={line[key]} maxLength={key === 'product' ? 100 : 24}
                onBlur={() => touch(fieldId)} aria-invalid={Boolean(showIssue)} aria-describedby={showIssue ? `${fieldId}-error` : undefined}
                inputMode={['quantity', 'price', 'discount', 'tax'].includes(key) ? 'decimal' : 'text'}
                onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, [key]: event.target.value } : item))} />
              </label>{showIssue && <small className="ai-entry__error" id={`${fieldId}-error`}>{labels[issue]}</small>}</div>
            })}
          </div>
          {invalid && <p role="status">{labels.invalid}</p>}
          {results[index] && lines.length > 1 && <p>{labels.total}: <strong>{format(results[index]!.total)}</strong></p>}
          <button type="button" className="btn btn--ghost" disabled={lines.length >= AI_LINE_LIMIT} aria-label={`${labels.duplicate} ${index + 1}`} onClick={() => setLines((current) => {
            if (current.length >= AI_LINE_LIMIT) return current
            const position = current.findIndex((item) => item.id === line.id)
            return [...current.slice(0, position + 1), { ...line, id: crypto.randomUUID() }, ...current.slice(position + 1)]
          })}>{labels.duplicate}</button>
          {lines.length > 1 && <button type="button" className="btn btn--ghost" aria-label={`${labels.remove} ${index + 1}`} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>{labels.remove}</button>}
        </fieldset>
      })}
      <button type="button" className="btn btn--ghost" disabled={disabled || lines.length >= AI_LINE_LIMIT} onClick={() => setLines((current) => [...current, newLine()])}>{labels.add}</button>
      <p className="ai-entry__hint">{labels.hint}</p>
      <div aria-live="polite">
        {result ? <dl className="ai-entry__totals">{quoteKeys.map((key) => <div key={key}><dt>{labels[key]}</dt><dd>{format(result[key])}</dd></div>)}</dl>
          : results.every(Boolean) && <p role="status">{labels.invalid}</p>}
      </div>
      <p className="ai-entry__hint">{labels.note}</p>
      {canDraft && <>
        <details className="ai-entry__preview"><summary>{labels.previewCommand}</summary>
          <pre dir="auto">{text}</pre>
          <p>{labels.commandLength}: {text.length}/{AI_COMMAND_LIMIT}</p>
        </details>
        {tooLong && <p role="status">{labels.tooLong} ({text.length}/{AI_COMMAND_LIMIT})</p>}
        <button type="button" className="btn btn--primary" disabled={disabled || !ready} onClick={() => {
          onDraft(text)
          setOpen(false)
        }}>{labels.draft}</button>
        {!ready && !tooLong && <p className="ai-entry__hint">{labels.required}</p>}
      </>}
    </div>}
  </div>
}
