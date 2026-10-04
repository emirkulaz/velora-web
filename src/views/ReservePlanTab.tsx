import { useI18n } from '../i18n/I18nProvider'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiGet, apiPost } from '../data/api'
import { calculateReservePlan, explainReservePlan, initialReservePlan, reconcileLine, validateReservePlan, type PlanData, type PlanLine, type ReservePlan } from '../data/reservePlan'
import './ReservePlanTab.css'
import { CashAccountForm } from '../components/CashAccountForm'

interface Snapshot {
  plan: ReservePlan | null
  data: PlanData
  updatedAt: string | null
  generatedAt: string
  suggestions: Array<{ employeeId: number; label: string; gross: number; reviewRequired: boolean; advances: Array<{ id: number; amount: number; cashTransactionId: number | null }> }>
}
const da = (n: number) => `${n.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} DA`
const emptyPlan = (): ReservePlan => ({ ...initialReservePlan(), lines: [], bankScenario: null, openingMode: 'current', insuranceMode: 'separate', insuranceExpenseId: null })
export function ReservePlanTab({ canWrite = false }: { canWrite?: boolean }) {
  const { t } = useI18n()
  const kinds = { collection: t('reserve.text00'), salary: t('reserve.text01'), advanceOffset: t('reserve.text02'), insurance: t('reserve.text03'), expense: t('reserve.text04'), transfer: t('reserve.text05') }
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [plan, setPlan] = useState<ReservePlan>(emptyPlan)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [explanation, setExplanation] = useState('')
  const [month, setMonth] = useState('')
  const initialLoadRef = useRef(false)
  const load = useCallback(async (selectedMonth?: string, preserve = false) => {
    setBusy(true); setError('')
    try {
      const result = await apiGet<Snapshot>(`/reserve-plan${selectedMonth ? `?month=${selectedMonth}` : ''}`)
      setSnapshot(current => preserve && current ? { ...current, data: result.data, generatedAt: result.generatedAt, suggestions: result.suggestions } : result)
      if (!preserve) {
        const loaded = result.plan ?? emptyPlan()
        const loadedMonth = loaded.month ?? selectedMonth ?? '2026-10'
        setPlan({ ...loaded, month: loadedMonth }); setDirty(false); setMonth(loadedMonth)
        // A legacy undated draft is a new monthly plan, not an existing saved month.
        if (result.plan && !result.plan.month) setSnapshot(current => current ? { ...current, updatedAt: null } : current)
      }
      setExplanation('')
    } catch (e) { setError(e instanceof Error ? e.message : t('reserve.text06')) }
    finally { setBusy(false) }
  }, [t])
  useEffect(() => {
    if (initialLoadRef.current) return
    const timer = window.setTimeout(() => { initialLoadRef.current = true; void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])
  useEffect(() => {
    const timer = window.setInterval(() => {
      void apiGet<Snapshot>(`/reserve-plan${plan.month ? `?month=${plan.month}` : ''}`).then(result => {
        setSnapshot(current => current ? { ...current, data: result.data, generatedAt: result.generatedAt, suggestions: result.suggestions } : result)
      }).catch(() => setError(t('reserve.text07')))
    }, 60000)
    return () => window.clearInterval(timer)
  }, [plan.month, t])
  const change = (patch: Partial<ReservePlan>) => { setPlan(p => ({ ...p, ...patch })); setDirty(true); setNotice(''); setExplanation('') }
  const lineChange = (id: string, patch: Partial<PlanLine>) => change({ lines: plan.lines.map(l => l.id === id ? { ...l, ...patch } : l) })
  const add = (kind: PlanLine['kind'] = 'expense') => change({ lines: [...plan.lines, { id: crypto.randomUUID(), label: kinds[kind], kind, amount: 0, date: null, accountId: null, deferred: false, assumption: false, transactionIds: [] }] })
  async function save() {
    const errors = validateReservePlan(plan)
    if (!plan.month) errors.push(t('reserve.text08'))
    if (errors.length) { setError(errors.join(' ')); return }
    setBusy(true); setError('')
    try {
      const saved = await apiPost<{ updatedAt: string }>('/reserve-plan', { plan, expectedUpdatedAt: snapshot?.updatedAt ?? null })
      setSnapshot(s => s ? { ...s, updatedAt: saved.updatedAt, plan } : s); setDirty(false); setNotice(t('reserve.text09'))
    } catch (e) { setError(e instanceof Error ? e.message : 'Plan kaydedilemedi.') }
    finally { setBusy(false) }
  }
  const accountSelect = (value: number | null | undefined, onChange: (id: number | null) => void, label: string) => <select aria-label={label} value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}><option value="">{t('reserve.text10')}</option>{snapshot?.data.accounts.filter(a => a.currency === snapshot.data.currency).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
  const data = snapshot?.data
  const errors = validateReservePlan(plan)
  const results = data && !errors.length ? (plan.insuranceMode === 'unknown' ? ['included','separate'] as const : [plan.insuranceMode]).map(mode => calculateReservePlan(plan, data, mode)) : []
  return <section className="panel panel--full reserve-plan">
    <h2>{t('reserve.text11')}</h2>
    <p>{t('reserve.text12')}</p>
    {plan.reserve === null && <p role="status">{t('reserve.unset')}</p>}
    <div className="reserve-plan__actions"><label>{t('reserve.text13')}<input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label><button type="button" disabled={busy || !month} onClick={() => { if (!dirty || window.confirm(t('reserve.text14'))) void load(month) }}>{t('reserve.text15')}</button><button type="button" disabled={busy} onClick={() => void load(plan.month ?? undefined, true)}>{t('reserve.text16')}</button></div>
    {busy && <p role="status">{t('reserve.text17')}</p>}{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {data && <>
      <p>{t('reserve.text18')} {snapshot.generatedAt} · {data.currency} {t('reserve.text19')}</p>
      <div className="reserve-plan__balances">{data.accounts.map(a => <article key={a.id}><span>{a.balanceReview ? t('reserve.text20') : t('reserve.text21')}{a.name}</span><strong>{a.balance.toLocaleString('tr-TR')} {a.currency}</strong>{a.balanceReview && <p role="alert">{t('reserve.text22')} {a.recordedBalance?.toLocaleString('tr-TR')} {a.currency}{t('reserve.text23')}</p>}</article>)}</div>
      {plan.lines.filter(l => l.kind === 'insurance' && reconcileLine(l,data).remaining > 0).map(l => <aside className="reserve-plan__insurance" role="status" key={l.id}><strong>{t('reserve.text24')} {da(reconcileLine(l,data).remaining)}</strong><p>{!l.date ? t('reserve.dueRequired') : `${l.date < data.today ? t('reserve.overdue') : t('reserve.due')} · ${l.date}`} · {plan.insuranceMode === 'unknown' ? t('reserve.text25') : plan.insuranceMode === 'included' ? t('reserve.text26') : t('reserve.text27')}</p></aside>)}
      <fieldset disabled={!canWrite || busy}>
        <legend>{t('reserve.text28')} {dirty ? t('reserve.text29') : ''}</legend>
        {canWrite && <CashAccountForm onCreated={() => void load(plan.month ?? undefined, true)} />}
        <div className="reserve-plan__grid">
          <label>{t('reserve.text30')}<input type="month" value={plan.month ?? ''} onChange={e => { setMonth(e.target.value); change({ month: e.target.value || null }); setSnapshot(s => s ? { ...s, updatedAt: s.plan?.month === e.target.value ? s.updatedAt : null } : s) }} /></label>
          <label>{t('reserve.text31')}<input type="number" min="0" step="0.01" value={plan.reserve ?? ''} placeholder={t('reserve.text32')} onChange={e => change({ reserve: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label>{t('reserve.text33')}{accountSelect(plan.cashAccountId, id => change({ cashAccountId: id }), t('reserve.text33'))}</label>
          <label>{t('reserve.text34')}{accountSelect(plan.bankAccountId, id => change({ bankAccountId: id }), t('reserve.text34'))}</label>
          <label>{t('reserve.text35')}<select value={plan.openingMode} onChange={e => change({ openingMode: e.target.value as ReservePlan['openingMode'] })}><option value="excluded">{t('reserve.text36')}</option><option value="manual">{t('reserve.text37')}</option><option value="current">{t('reserve.text38')}</option></select></label>
          {plan.openingMode === 'manual' && <label>{t('reserve.text39')}<input type="number" min="0" value={plan.openingCash} onChange={e => change({ openingCash: Number(e.target.value) })} /></label>}
          <label>{t('reserve.text40')}<input type="number" min="0" value={plan.bankScenario ?? ''} onChange={e => change({ bankScenario: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label>{t('reserve.text41')}<select value={plan.insuranceMode} onChange={e => change({ insuranceMode: e.target.value as ReservePlan['insuranceMode'] })}><option value="unknown">{t('reserve.text42')}</option><option value="included">{t('reserve.text43')}</option><option value="separate">{t('reserve.text44')}</option></select></label>
          {plan.insuranceMode !== 'separate' && <label>{t('reserve.text45')}<select value={plan.insuranceExpenseId ?? ''} onChange={e => change({ insuranceExpenseId: e.target.value || null })}><option value="">{t('reserve.text46')}</option>{plan.lines.filter(l => l.kind === 'expense').map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>}
          <label><input type="checkbox" checked={plan.bankAvailable} onChange={e => change({ bankAvailable: e.target.checked })} /> {t('reserve.text47')}</label>
        </div>
        <p>{t('reserve.text48')}</p>
        <h3>{t('reserve.text49')}</h3>
        <div className="reserve-plan__lines">{plan.lines.map(l => {
          const actual = reconcileLine(l,data)
          return <article key={l.id} className="reserve-plan__line">
            <div className="reserve-plan__grid">
              <label>{t('reserve.text50')}<input value={l.label} maxLength={250} onChange={e => lineChange(l.id,{ label: e.target.value })} /></label>
              <label>{t('reserve.text51')}<select value={l.kind} onChange={e => lineChange(l.id,{ kind: e.target.value as PlanLine['kind'], transactionIds: [] })}>{Object.entries(kinds).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>{t('reserve.text52')}<input type="number" min="0" step="0.01" value={l.amount} onChange={e => lineChange(l.id,{ amount: Number(e.target.value) })} /></label>
              <label>{l.kind === 'collection' ? t('reserve.text53') : t('reserve.text54')}<input type="date" value={l.date ?? ''} onChange={e => lineChange(l.id,{ date: e.target.value || null })} /></label>
              {l.kind !== 'advanceOffset' && <label>{l.kind === 'collection' ? t('reserve.text55') : t('reserve.text56')}{accountSelect(l.accountId, id => lineChange(l.id,{ accountId: id, transactionIds: [] }), `${l.label} hesabı`)}</label>}
              {l.kind === 'transfer' && <label>{t('reserve.text57')}{accountSelect(l.toAccountId, id => lineChange(l.id,{ toAccountId: id }), `${l.label} hedef hesabı`)}</label>}
              {l.kind === 'advanceOffset' && <label>{t('reserve.text58')}<select value={l.salaryId ?? ''} onChange={e => lineChange(l.id,{ salaryId: e.target.value || null })}><option value="">{t('reserve.text59')}</option>{plan.lines.filter(s => s.kind === 'salary').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>}
              <label><input type="checkbox" checked={l.deferred} onChange={e => lineChange(l.id,{ deferred: e.target.checked })} /> {t('reserve.text60')}</label>
              <label><input type="checkbox" checked={l.assumption} onChange={e => lineChange(l.id,{ assumption: e.target.checked })} /> {t('reserve.text61')}</label>
            </div>
            {l.kind !== 'advanceOffset' && l.kind !== 'transfer' && <label>{t('reserve.text62')}<select multiple aria-label={`${l.label} gerçekleşen kayıtları`} value={l.transactionIds.map(String)} onChange={e => lineChange(l.id,{ transactionIds: Array.from(e.target.selectedOptions).map(o => Number(o.value)) })}>{data.movements.filter(m => m.cashAccountId === l.accountId && !m.reversesId && !data.movements.some(r => r.reversesId === m.id) && (l.kind === 'collection' ? m.debit : m.credit) > 0).map(m => <option key={m.id} value={m.id}>#{m.id} · {m.date} · {da(l.kind === 'collection' ? m.debit : m.credit)} · {m.description}</option>)}</select></label>}
            {l.kind === 'transfer' && <label>{t('reserve.text63')}<select multiple aria-label={`${l.label} transfer kayıtları`} value={l.transactionIds.map(String)} onChange={e => lineChange(l.id,{ transactionIds: Array.from(e.target.selectedOptions).map(o => Number(o.value)) })}>{data.movements.filter(m => !m.reversesId && m.date <= data.today && !data.movements.some(r => r.reversesId === m.id) && ((m.cashAccountId === l.accountId && m.credit > 0) || (m.cashAccountId === l.toAccountId && m.debit > 0))).map(m => <option key={m.id} value={m.id}>#{m.id} · {m.date} · {m.cashAccountId === l.accountId ? t('reserve.text64') : t('reserve.text65')} · {da(m.credit || m.debit)} · {m.description}</option>)}</select></label>}
            <p>{t('reserve.text66')} {da(actual.paid)} {t('reserve.text67')} {da(actual.remaining)} {actual.remaining === 0 ? t('reserve.text68') : ''} {l.kind === 'advanceOffset' ? t('reserve.text69') : ''}</p>
            <button type="button" onClick={() => change({ lines: plan.lines.filter(row => row.id !== l.id && row.salaryId !== l.id) })}>{t('reserve.text70')}</button>
          </article>
        })}</div>
        <div className="reserve-plan__actions">{Object.entries(kinds).map(([kind,label]) => <button type="button" key={kind} onClick={() => add(kind as PlanLine['kind'])}>+ {label}</button>)}</div>
        <details><summary>{t('reserve.text71')}</summary><p>{t('reserve.text72')}</p>{snapshot.suggestions.map(s => <button type="button" key={s.employeeId} disabled={plan.lines.some(l => l.id === `employee-${s.employeeId}`)} onClick={() => {
          const id = `employee-${s.employeeId}`
          change({ lines: [...plan.lines, { id, label: `${s.label} — brüt maaş önerisi`, kind: 'salary', amount: s.gross, date: null, accountId: plan.cashAccountId, deferred: false, assumption: true, transactionIds: [] }, ...s.advances.map(a => ({ id: `advance-${a.id}`, label: `${s.label} — avans #${a.id}`, kind: 'advanceOffset' as const, amount: a.amount, salaryId: id, date: null, accountId: null, deferred: false, assumption: true, transactionIds: [] }))] })
        }}>{s.label}: {da(s.gross)} · {s.reviewRequired ? 'inceleme gerekli' : t('reserve.text73')} {t('reserve.text74')}</button>)}</details>
        <button type="button" disabled={busy} onClick={() => void save()}>{t('reserve.text75')}</button>
      </fieldset>
      {!!errors.length && <p role="alert">{errors.join(' ')}</p>}
      <div className="reserve-plan__scenarios">{results.map(r => <article key={r.mode}><h3>{t('reserve.text03')} {r.mode === 'included' ? t('reserve.text76') : t('reserve.text77')}</h3><p>{t('reserve.text78')} {plan.openingMode === 'excluded' ? t('reserve.text79') : t('reserve.text76')}</p>{!r.reliableOpening && <p role="alert">{t('reserve.text80')}</p>}{r.reliableOpening && <dl><dt>{t('reserve.text81')}</dt><dd>{da(r.collections)}</dd><dt>{t('reserve.text82')}</dt><dd>{da(r.outflows)}</dd>{r.mode === 'separate' && <><dt>{t('reserve.text83')}</dt><dd>{da(r.cashBeforeInsurance)}</dd><dt>{t('reserve.text84')}</dt><dd>{da(r.totalBeforeInsurance)}</dd></>}<dt>{t('reserve.text85')} {plan.lines.some(l => l.accountId === null) ? t('reserve.text86') : ''}</dt><dd>{da(r.cash)}</dd><dt>{t('reserve.text87')}</dt><dd>{da(r.bank)}</dd><dt>{t('reserve.text88')}</dt><dd>{da(r.total)}</dd><dt>{t('reserve.text89')}</dt><dd>{da(r.cashFundingGap)}</dd><dt>{t('reserve.text90')}</dt><dd>{r.reserveNeed === null ? 'Rezerv belirlenmedi' : da(r.reserveNeed)}</dd><dt>{t('reserve.text91')}</dt><dd>{r.cashReserveGap === null ? t('reserve.text32') : da(r.cashReserveGap)}</dd><dt>{t('reserve.text92')}</dt><dd>{da(r.transferNeeded)} {t('reserve.text93')}</dd><dt>{t('reserve.text94')}</dt><dd>{da(r.deferredImpact)}</dd></dl>}<ul>{r.warnings.map(w => <li key={w}>{w}</li>)}</ul>{r.reliableOpening && r.schedule.map(s => <p key={s.id}>{s.date} · {s.label}{t('reserve.text95')} {da(s.accountShortfall)} {t('reserve.text96')} {s.reserveShortfall === null ? 'belirlenmedi' : da(s.reserveShortfall)}{s.dependencies.length > 0 && ` · Bağlı olunan henüz kullanılamayan tahsilatlar: ${s.dependencies.map(d => `${d.label} ${da(d.amount)} (${d.date ?? 'vade eksik'})`).join(', ')}`}</p>)}</article>)}</div>
      <button type="button" disabled={!!errors.length} onClick={() => setExplanation(explainReservePlan(plan,data))}>{t('reserve.text97')}</button>
      {explanation && <pre className="reserve-plan__explanation">{explanation}</pre>}
    </>}
  </section>
}
