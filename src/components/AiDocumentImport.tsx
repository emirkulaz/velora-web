import { useEffect, useRef, useState } from 'react'
import { apiGet, apiPost, apiRequest } from '../data/api'
import { ConfirmDialog } from './ConfirmDialog'
import './AiDocumentImport.css'

type Kind = 'unknown' | 'cash' | 'customer_ledger' | 'supplier_ledger' | 'invoice' | 'delivery' | 'stock' | 'order'
type Choice = { id: number; name: string; currency?: string; orderNumber?: string }
type Row = {
  key: string; page: number; line: number; table: string; rowKind: string;
  date: string; description: string; debit: string; credit: string; balance: string; currency: string;
  party: string; employee: string; product: string; quantity: string; unitPrice: string; ledgerType: string; orderNumber: string;
  partyId: number | null; employeeId: number | null; productId: number | null; orderId: number | null;
  excluded: boolean; reviewed: boolean; issues: string[];
  modelName?: string; color?: string; widthCm?: string; sourceDescription?: string;
  unit?: string; packages?: string; reference?: string; stockOperation?: string; sheet?: string;
  existingId?: number | null; existingEntity?: string; distinctConfirmed?: boolean;
}
type Draft = { kind: Kind; currency: string; documentNumber: string; status: 'processing' | 'ready' | 'error'; error?: string; pageCount: number; cashAccountId: number | null; rows: Row[]; duplicateOf?: string; distinctConfirmed?: boolean; warehouseId?: number | null }
type DocumentState = { rowMatches?: Record<string, { id: number; entity: string; label: string; compatible: boolean }[]>; id: string; version: number; fileName: string; draft: Draft; issues: Record<string, string[]>; receipts: Record<string, { id: number; status: string }>; duplicateCandidates?: { id: string; fileName: string }[]; options: null | { customers: Choice[]; suppliers: Choice[]; employees: Choice[]; products: Choice[]; orders: Choice[]; accounts: Choice[]; warehouses?: Choice[] }; writePreview?: { previewToken: string; ready: boolean; lines: string[] } }
type Result = { answer: string; applied: boolean; data?: { results: { key: string; status: string; error?: string; id?: number }[]; counts: Record<string, number> } }
const kindLabels: Record<Kind, string> = { unknown: 'Belge türünü seçin', cash: 'Kasa hareketleri', customer_ledger: 'Müşteri carisi', supplier_ledger: 'Tedarikçi carisi', invoice: 'Fatura', delivery: 'Teslimat', stock: 'Stok', order: 'Sipariş' }
const statusLabels: Record<string, string> = { added: 'Eklendi', updated: 'Düzeltildi', skipped: 'Atlandı', failed: 'Başarısız' }

export function AiDocumentImport({ onRefresh, driveLink, textInput, documentId }: { onRefresh?: () => void; driveLink?: string; textInput?: string; documentId?: string }) {
  const [document, setDocument] = useState<DocumentState | null>(null)
  const [url, setUrl] = useState(driveLink ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [sheet, setSheet] = useState('')
  const [page, setPage] = useState(0)
  const busyRef = useRef(false)
  useEffect(()=>{if(!documentId)return;let cancelled=false;void apiGet<DocumentState>(`/ai/documents/${documentId}`).then(next=>{if(!cancelled){setDocument(next);setResult(null)}}).catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Sipariş önizlemesi alınamadı.')});return()=>{cancelled=true}},[documentId])
  useEffect(() => { if (driveLink) setUrl(driveLink) }, [driveLink])
  useEffect(() => {
    if (document?.draft.status !== 'processing') return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      try { const next = await apiGet<DocumentState>(`/ai/documents/${document.id}`); if (!cancelled) { setDocument(next); if (next.draft.status === 'processing') timer = setTimeout(poll, 2500) } }
      catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Belge durumu alınamadı.') }
    }
    timer = setTimeout(poll, 1500)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [document?.id, document?.draft.status])
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(true); setError('')
    try { await action() } catch (err) { setError(err instanceof Error ? err.message : 'Belge işlemi başarısız.') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const upload = (file?: File) => {
    if (!file) return
    void run(async () => {
      if (!/\.(xlsx?|pdf|jpe?g|png)$/i.test(file.name) || file.size > 20 * 1024 * 1024) throw new Error('Excel, PDF, JPG veya PNG seçin (en fazla 20 MB).')
      const body = new FormData(); body.append('file', file)
      const next = await apiRequest<DocumentState>('/ai/documents/upload', { method: 'POST', body })
      setDocument(next); setResult(null); setSheet(''); setPage(0)
    })
  }
  const editDraft = (patch: Partial<Draft>) => { setDocument(current => current ? { ...current, draft: { ...current.draft, ...patch }, writePreview: undefined } : current); setResult(null) }
  const editRow = (key: string, patch: Partial<Row>) => { if (document) editDraft({ rows: document.draft.rows.map(row => row.key === key ? { ...row, ...patch } : row) }) }
  const review = () => void run(async () => {
    if (!document) return
    const next = await apiPost<DocumentState>(`/ai/documents/${document.id}/preview`, { version: document.version, draft: document.draft })
    setDocument(next); setResult(null)
  })
  const confirm = () => void run(async () => {
    if (!document?.writePreview?.ready) return
    const response = await apiPost<Result>('/ai/confirm-write', { previewToken: document.writePreview.previewToken })
    setResult(response); setConfirmOpen(false)
    setDocument(current => current ? { ...current, writePreview: undefined } : current)
    if (response.applied) onRefresh?.()
  })
  const draft = document?.draft
  const options = document?.options
  const visibleRows = draft?.rows.filter(r => !sheet || r.sheet === sheet) ?? []
  const select = (row: Row, field: 'partyId' | 'employeeId' | 'productId' | 'orderId', choices: Choice[], label: string) => <label>{label}<select value={row[field] ?? ''} onChange={e => editRow(row.key, { [field]: e.target.value ? Number(e.target.value) : null })}><option value="">{field === 'productId' ? 'Ürün bağlantısı yok — serbest satır' : 'Eşleşme seçin'}</option>{choices.map(c => <option key={c.id} value={c.id}>{c.name ?? c.orderNumber}{c.currency ? ` (${c.currency})` : ''}</option>)}</select></label>
  return <section className="ai-document" aria-label="Belgeden ERP aktarımı">
    <p><strong>Belgeden ERP’ye aktar</strong> · Excel, PDF, JPG, PNG, TXT · En fazla 20 MB / 30 PDF sayfası</p>
    <p>Belge AI okuma servisine gönderilir. Kayıtlar yalnızca tabloyu kontrol edip onayladığınızda aktarılır.</p>
    <fieldset disabled={busy || draft?.status === 'processing'} className="ai-document__upload">
      <label>Dosya yükle<input type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png,.xlsx,.xls,.txt,text/plain" onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }} /></label>
      {!!textInput?.trim() && <button type="button" className="btn btn--ghost" onClick={() => void run(async () => { if(textInput.length>20000) throw new Error('Metin en fazla 20000 karakter olabilir; metin kesilmedi.'); const next=await apiPost<DocumentState>('/ai/documents/text',{text:textInput});setDocument(next);setResult(null);setPage(0);setSheet('') })}>Sohbetteki metni kayıt tablosuna dönüştür</button>}
      <label>Google Drive bağlantısı<input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://drive.google.com/file/d/…" /></label>
      <button type="button" className="btn btn--ghost" disabled={!url.trim()} onClick={() => void run(async () => { const next = await apiPost<DocumentState>('/ai/documents/drive', { url: url.trim() }); setDocument(next); setResult(null) })}>İzin verilen bağlantıyı oku</button>
    </fieldset>
    {error && <p role="alert">{error}</p>}
    {draft?.status === 'processing' && <p role="status">Belgenin bütün sayfaları okunuyor… Bu işlem birkaç dakika sürebilir.</p>}
    {draft?.status === 'error' && <p role="alert">{draft.error}</p>}
    {document && draft?.status === 'ready' && options && <>
      <p><strong>{document.fileName}</strong> · {draft.pageCount} sayfa · {draft.rows.length} kaynak satırı</p>
      {!!document.duplicateCandidates?.length && <label>Aynı içerikli kayıtlı belge bulundu. Bu onun başka bir kopyası mı?<select value={draft.duplicateOf ?? (draft.distinctConfirmed ? 'distinct' : '')} onChange={e => editDraft({ duplicateOf: e.target.value && e.target.value !== 'distinct' ? e.target.value : undefined, distinctConfirmed: e.target.value === 'distinct' })}><option value="">Eşleşmeyi kontrol edin</option><option value="distinct">Kontrol ettim: ayrı bir gerçek belge</option>{document.duplicateCandidates.map(c => <option key={c.id} value={c.id}>Aynı belge: {c.fileName} — yeniden kaydetme</option>)}</select></label>}
      <fieldset disabled={busy} className="ai-document__fields">
        <label>Belge türü<select value={draft.kind} onChange={e => editDraft({ kind: e.target.value as Kind, rows: draft.rows.map(r => ({ ...r, partyId: null })) })}>{Object.entries(kindLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Para birimi<input value={draft.currency} maxLength={3} onChange={e => editDraft({ currency: e.target.value.toUpperCase() })} /></label>
        <button type="button" className="btn btn--ghost" onClick={() => editDraft({rows:draft.rows.map(r=>r.excluded?r:{...r,currency:draft.currency})})}>Para birimini seçili satırlara uygula</button>
        <label>Belge numarası<input value={draft.documentNumber} onChange={e => editDraft({ documentNumber: e.target.value })} /></label>
        {draft.kind === 'cash' && <label>Kasa<select value={draft.cashAccountId ?? ''} onChange={e => editDraft({ cashAccountId: e.target.value ? Number(e.target.value) : null })}><option value="">Kasa seçin</option>{options.accounts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.currency})</option>)}</select></label>}
        {draft.kind === 'stock' && <label>Depo<select value={draft.warehouseId ?? ''} onChange={e=>editDraft({warehouseId:e.target.value?Number(e.target.value):null})}><option value="">Depo seçin</option>{options.warehouses?.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
      </fieldset>
      <div className="ai-document__fields"><label>Kaynak sayfa<select value={sheet} onChange={e=>{setSheet(e.target.value);setPage(0)}}><option value="">Bütün sayfalar</option>{[...new Set(draft.rows.map(r=>r.sheet).filter(Boolean))].map(s=><option key={s}>{s}</option>)}</select></label><button className="btn btn--ghost" onClick={()=>editDraft({rows:draft.rows.map(r=>(!sheet||r.sheet===sheet)&&r.rowKind==='movement'?{...r,excluded:true}:r)})}>Bu sayfadaki satırları seçme</button><button className="btn btn--ghost" onClick={()=>editDraft({rows:draft.rows.map(r=>(!sheet||r.sheet===sheet)&&r.rowKind==='movement'?{...r,excluded:false}:r)})}>Bu sayfadaki hareketleri seç</button><button disabled={page===0} onClick={()=>setPage(p=>p-1)}>Önceki</button><span>{page+1} / {Math.max(1,Math.ceil(visibleRows.length/50))}</span><button disabled={(page+1)*50>=visibleRows.length} onClick={()=>setPage(p=>p+1)}>Sonraki</button></div>
      <p>{draft.kind === 'cash' ? 'Borç = giriş, Alacak = çıkış. Bakiye hareketlerden hesaplanır; açılış ve toplam satırları ödeme değildir.' : 'Cari borç/alacak sütunları belge anlamıyla korunur; kasa girişi/çıkışı oluşturulmaz.'}</p>
      <fieldset disabled={busy || confirmOpen} style={{ border: 0, padding: 0, minWidth: 0 }}><div className="ai-document__table" tabIndex={0} aria-label="Belge satırları">
        <table><thead><tr><th>Aktar</th><th>Kaynak</th><th>Tarih</th><th>Açıklama</th><th>{draft.kind === 'cash' ? 'Borç / giriş' : 'Borç'}</th><th>{draft.kind === 'cash' ? 'Alacak / çıkış' : 'Alacak'}</th><th>Bakiye</th><th>Para birimi</th><th>Eşleştirmeler</th><th>Kontrol</th></tr></thead><tbody>
          {visibleRows.slice(page*50,(page+1)*50).map(row => <tr key={row.key} className={document.issues[row.key]?.length ? 'ai-document__invalid' : ''}>
            <td><input aria-label={`${row.key} aktar`} type="checkbox" checked={!row.excluded && row.rowKind === 'movement'} disabled={busy || row.rowKind !== 'movement'} onChange={e => editRow(row.key, { excluded: !e.target.checked })} /></td>
            <td title={document.fileName}>{row.sheet || `Sayfa ${row.page}`}<br />Satır {row.line}<br />{row.reference && `BON/ref: ${row.reference}`}<br />{row.rowKind !== 'movement' && row.rowKind}</td>
            {(['date', 'description', 'debit', 'credit', 'balance', 'currency'] as const).map(field => <td key={field}><input aria-label={`${row.key} ${field}`} type={field === 'date' ? 'date' : 'text'} value={row[field]} disabled={busy} onChange={e => editRow(row.key, { [field]: e.target.value })} /></td>)}
            <td><details><summary>Eşleşmeleri düzenle</summary>
              {!!document.rowMatches?.[row.key]?.length && <label>Mevcut işlem eşleşmesi<select value={row.existingId ? String(row.existingId) : row.distinctConfirmed ? 'distinct' : ''} onChange={e=>{const match=document.rowMatches?.[row.key]?.find(m=>String(m.id)===e.target.value);editRow(row.key,{existingId:match?.id??null,existingEntity:match?.entity,distinctConfirmed:e.target.value==='distinct'})}}><option value="">Kontrol edin</option>{document.rowMatches[row.key].map(m=><option key={m.id} value={m.id} disabled={!m.compatible}>{m.label}{m.compatible?' — yeniden kaydetme':' — alanlar çelişiyor'}</option>)}<option value="distinct">Kontrol ettim: ayrı bir gerçek işlem</option></select></label>}
              <label>BON / işlem referansı<input value={row.reference??''} onChange={e=>editRow(row.key,{reference:e.target.value})}/></label>
              <label>Belgedeki cari<input value={row.party} onChange={e => editRow(row.key, { party: e.target.value, partyId: null })} /></label>
              {select(row, 'partyId', draft.kind === 'supplier_ledger' ? options.suppliers : options.customers, 'Cari')}
              <label>Belgedeki çalışan<input value={row.employee} onChange={e => editRow(row.key, { employee: e.target.value, employeeId: null })} /></label>
              {select(row, 'employeeId', options.employees, 'Çalışan')}
              {(draft.kind === 'invoice' || draft.kind === 'delivery' || draft.kind === 'stock' || draft.kind === 'order') && <>
                {(['modelName','color','widthCm'] as const).map(field=><label key={field}>{({modelName:'Model / serbest ürün adı',color:'Renk',widthCm:'Ölçü (cm)'})[field]}<input aria-label={`${row.key} ${field}`} value={row[field]??''} onChange={e=>editRow(row.key,{[field]:e.target.value,productId:null})}/></label>)}
                <p>Kaynak: {row.sourceDescription||row.description}</p><span>{row.product}</span>{select(row, 'productId', options.products, 'Ürün')}
                <label>Miktar<input value={row.quantity} onChange={e => editRow(row.key, { quantity: e.target.value })} /></label>
                <label>Birim fiyat<input value={row.unitPrice} onChange={e => editRow(row.key, { unitPrice: e.target.value })} /></label>
                <label>Birim<select value={row.unit??''} onChange={e=>editRow(row.key,{unit:e.target.value})}><option value="">Birim seçin</option><option value="PIECE">Adet</option><option value="METER">Metre</option><option value="KILOGRAM">Kilogram</option><option value="BAG">Poşet (dönüşüm gerekli)</option></select></label>
                <label>Poşet sayısı<input value={row.packages??''} onChange={e=>editRow(row.key,{packages:e.target.value})}/></label>
                <label>BON / referans<input value={row.reference??''} onChange={e=>editRow(row.key,{reference:e.target.value})}/></label>
                {draft.kind==='stock'&&<label>Stok işlem türü<select value={row.stockOperation??''} onChange={e=>editRow(row.key,{stockOperation:e.target.value})}><option value="">Tür seçin</option><option value="COUNT">Sayım (hedef miktar)</option><option value="OPENING">Başlangıç (yalnız boş stok)</option><option value="INBOUND">Giriş</option><option value="OUTBOUND">Çıkış</option></select></label>}
                {draft.kind === 'delivery' && select(row, 'orderId', options.orders, 'Sipariş')}
              </>}
              {draft.kind.endsWith('_ledger') && <label>Cari işlem türü<select value={row.ledgerType} onChange={e => editRow(row.key, { ledgerType: e.target.value })}><option value="">Tür seçin</option>{(draft.kind === 'customer_ledger' ? ['SALE','PAYMENT','RETURN','ADJUSTMENT'] : ['PURCHASE','PAYMENT','RETURN','ADJUSTMENT']).map(type => <option key={type}>{type}</option>)}</select></label>}
            </details></td>
            <td>{document.issues[row.key]?.map((issue, i) => <p key={i}>{issue}</p>)}{row.issues.length > 0 && <label><input type="checkbox" checked={row.reviewed} onChange={e => editRow(row.key, { reviewed: e.target.checked })} />Okuma uyarılarını kontrol edip düzelttim</label>}{result?.data?.results.filter(r => r.key === row.key).map((r, i) => <p key={i}>{statusLabels[r.status] ?? r.status}{r.id ? ` #${r.id}` : ''} {r.error}</p>)}</td>
          </tr>)}
        </tbody></table>
      </div></fieldset>
      <div className="ai-document__actions"><button className="btn btn--ghost" disabled={busy} onClick={review}>Kontrol et ve önizle</button><button className="btn btn--primary" disabled={busy || !document.writePreview?.ready} onClick={() => setConfirmOpen(true)}>Doğrulanmış kayıtları aktar</button></div>
      {document.writePreview && <section aria-label="Kayıt önizlemesi"><h4>Hesaplama ve modül etkileri</h4>{document.writePreview.lines.map((line, index) => <p key={index}>{line}</p>)}</section>}
      {document.writePreview && !document.writePreview.ready && <p role="alert">Önizleme kayda hazır değil. İşaretli satırlardaki hataları düzeltin.</p>}
    </>}
    {result && <p role={result.applied ? 'status' : 'alert'}>{result.answer}</p>}
    <ConfirmDialog open={confirmOpen} title="Belge aktarımını onayla" message="Kontrol edilen satırlar şirketin ERP kayıtlarına aktarılacak. Onaylıyor musunuz?" onCancel={() => { if (!busy) setConfirmOpen(false) }} onConfirm={confirm} />
  </section>
}
