import { useId, useState } from 'react'
import { loadAiOrderReferences } from '../data/aiOrderReferences'
import { foldErpText } from '../data/aiUnderstanding'
import { useI18n } from '../i18n/I18nProvider'
import { aiWorkspaceLabels } from '../i18n/catalogs/aiWorkspace'
import { Icon } from './Icons'

export function AiOrderContext({ disabled, canReadFinance, onDraft }: { disabled: boolean; canReadFinance: boolean; onDraft: (text: string) => void }) {
  const { language, formatDate } = useI18n()
  const labels = aiWorkspaceLabels[language ?? 'tr']
  const id = useId()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<Awaited<ReturnType<typeof loadAiOrderReferences>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const selected = data?.orders.find((order) => String(order.id) === selectedId)
  const filtered = data?.orders.filter((order) => foldErpText(`${order.orderNumber} ${order.customerName ?? ''} ${order.productName ?? ''}`).includes(foldErpText(search))) ?? []
  async function load() {
    setLoading(true)
    setError(false)
    setData(null)
    setSelectedId('')
    try { setData(await loadAiOrderReferences()) } catch { setError(true) } finally { setLoading(false) }
  }
  return <div className="ai-order-context">
    <button type="button" className="ai-workspace-action" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><Icon name="cart" /><span>{labels.orders}</span><span aria-hidden="true">{open ? '−' : '+'}</span></button>
    {open && <div id={id} className="ai-order-context__body">
      <p>{labels.ordersHint}</p>
      <button type="button" className="btn btn--ghost" disabled={disabled || loading} onClick={() => void load()}>{loading ? labels.loading : labels.load}</button>
      {error && <p role="alert">{labels.error}</p>}
      {data && <>
        <p className="ai-entry__hint">{labels.loaded}: {formatDate(data.loadedAt, { dateStyle: 'short', timeStyle: 'short' })}</p>
        <fieldset className="ai-entry__fields" disabled={disabled || loading}>
          <label>{labels.search}<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>{labels.choose}<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">{labels.choose}</option>
            {selected && !filtered.some((order) => order.id === selected.id) && <option value={selected.id}>{selected.orderNumber} · {selected.customerName}</option>}
            {filtered.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {order.customerName ?? '—'} · {order.productName ?? '—'}</option>)}
          </select></label>
        </fieldset>
        {!filtered.length && <p role="status">{labels.empty}</p>}
        {selected && <div className="ai-order-context__questions">{[labels.status, labels.delivery, ...(canReadFinance ? [labels.payment] : [])].map((question) => <button key={question} type="button" className="quick-chip" disabled={disabled || loading} onClick={() => onDraft(`${labels.reference}: ${selected.orderNumber}. ${question}`)}>{question}</button>)}</div>}
      </>}
    </div>}
  </div>
}
