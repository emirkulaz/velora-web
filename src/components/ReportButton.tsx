import { useState } from 'react'
import { apiDownload } from '../data/api'

export type ReportType = 'production' | 'orders' | 'cash' | 'ledger' | 'stock' | 'customers' | 'requests' | 'expenses' | 'personnel' | 'deliveries' | 'daily-summary'

function todayAlgiers() { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Africa/Algiers' }) }

export function ReportButton({ type, label = 'Günlük Rapor' }: { type: ReportType; label?: string }) {
  const [date, setDate] = useState(todayAlgiers)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const download = async () => {
    if (busy) return
    setBusy(true); setError('')
    try {
      const blob = await apiDownload(`/reports/${type}/pdf?date=${encodeURIComponent(date)}`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a'); link.href = url; link.download = `vexor-${type}-${date}.pdf`; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setError(e instanceof Error ? e.message : 'PDF oluşturulamadı.') }
    finally { setBusy(false) }
  }
  return (
    <div className="report-control">
      <label className="report-control__date"><span>Rapor tarihi</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <button type="button" className="btn btn--report" onClick={() => void download()} disabled={busy}>{busy ? 'Hazırlanıyor…' : `PDF · ${label}`}</button>
      {error && <span className="report-control__error" role="alert">{error}</span>}
    </div>
  )
}
