export type PlanKind = 'collection' | 'salary' | 'advanceOffset' | 'insurance' | 'expense' | 'transfer'
export interface PlanLine {
  id: string
  label: string
  kind: PlanKind
  amount: number
  date: string | null
  accountId: number | null
  toAccountId?: number | null
  salaryId?: string | null
  deferred: boolean
  assumption: boolean
  transactionIds: number[]
}
export interface ReservePlan {
  month: string | null
  reserve: number | null
  cashAccountId: number | null
  bankAccountId: number | null
  bankAvailable: boolean
  openingMode: 'current' | 'excluded' | 'manual'
  openingCash: number
  bankScenario: number | null
  insuranceMode: 'included' | 'separate' | 'unknown'
  insuranceExpenseId?: string | null
  lines: PlanLine[]
}
export interface PlanAccount { id: number; name: string; currency: string; balance: number; recordedBalance?: number | null; balanceReview?: boolean }
export interface PlanMovement { id: number; cashAccountId: number; debit: number; credit: number; date: string; reversesId: number | null; customerId?: number | null; description?: string }
export interface PlanData { accounts: PlanAccount[]; movements: PlanMovement[]; today: string; currency: string }
const money = (n: number) => Math.round(n * 100) / 100
export function initialReservePlan(): ReservePlan {
  const line = (id: string, label: string, kind: PlanKind, amount: number): PlanLine => ({ id, label, kind, amount, date: null, accountId: null, deferred: false, assumption: false, transactionIds: [] })
  return { month: '2026-10', reserve: null, cashAccountId: null, bankAccountId: null, bankAvailable: false, openingMode: 'excluded', openingCash: 500, bankScenario: 100000, insuranceMode: 'unknown', insuranceExpenseId: 'expenses', lines: [line('dedouche', 'Dedouche — kullanıcı beyanı', 'collection', 126310), line('yacine', 'Yacine — kullanıcı beyanı', 'collection', 294000), line('expenses', 'Detayları ve ödeme durumu doğrulanmamış gider toplamı', 'expense', 334200), line('insurance', 'Sigorta', 'insurance', 156000)] }
}
export function validDate(value: string): boolean {
  try { return /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value } catch { return false }
}
export function validateReservePlan(plan: ReservePlan): string[] {
  const errors: string[] = []
  if (plan.month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(plan.month)) errors.push('Plan ayı geçersiz.')
  for (const n of [plan.openingCash, plan.reserve ?? 0, plan.bankScenario ?? 0, ...plan.lines.map(l => l.amount)]) if (!Number.isFinite(n) || n < 0 || n > 1e12) errors.push('Tutarlar geçerli ve sıfırdan büyük veya eşit olmalı.')
  if (plan.cashAccountId !== null && plan.cashAccountId === plan.bankAccountId) errors.push('Kasa ve banka ayrı hesaplar olmalı.')
  if (plan.insuranceMode !== 'separate' && plan.lines.some(l => l.kind === 'insurance') && !plan.lines.some(l => l.id === plan.insuranceExpenseId && l.kind === 'expense')) errors.push('Dahil sigortayı temsil eden toplu gider kalemini seçin; detaylarda ayrıca sigorta varsa ayrı seçin.')
  const bucket = plan.lines.find(l => l.id === plan.insuranceExpenseId)
  if (plan.insuranceMode !== 'separate' && bucket && plan.lines.some(l => l.kind === 'insurance')) {
    if (bucket.amount < plan.lines.filter(l => l.kind === 'insurance').reduce((n,l) => n+l.amount,0)) errors.push('Dahil sigorta tutarı toplu gideri aşamaz; dahil/ayrı durumunu doğrulayın.')
    if (bucket.transactionIds.length > 0) errors.push('Sigorta içeren toplu giderin gerçekleşen ödemelerini önce ayrı kalemlere detaylandırın; sigortayı kendi kaydına bağlayın ve ayrı seçin.')
  }
  const ids = new Set<string>(), transactions = new Set<number>()
  for (const l of plan.lines) {
    if (!l.id || ids.has(l.id)) errors.push('Kalem kimlikleri benzersiz olmalı.')
    ids.add(l.id)
    if (l.date && !validDate(l.date)) errors.push(`${l.label}: tarih geçersiz.`)
    if (l.accountId !== null && l.accountId !== plan.cashAccountId && l.accountId !== plan.bankAccountId) errors.push(`${l.label}: planın kasa veya banka hesabını seçin.`)
    if (l.toAccountId && l.toAccountId !== plan.cashAccountId && l.toAccountId !== plan.bankAccountId) errors.push(`${l.label}: transfer hedefi planın kasa veya banka hesabı olmalı.`)
    if (!plan.bankAvailable && plan.bankAccountId !== null && l.accountId === plan.bankAccountId && !l.deferred && l.kind !== 'collection' && l.kind !== 'advanceOffset') errors.push(`${l.label}: banka kullanılamıyor; ödeme hesabını değiştirin veya bankayı kullanılabilir seçin.`)
    if (l.kind === 'advanceOffset' && !plan.lines.some(s => s.id === l.salaryId && s.kind === 'salary')) errors.push(`${l.label}: mahsup için maaş seçilmeli.`)
    if (l.kind === 'transfer' && (!l.accountId || !l.toAccountId || l.accountId === l.toAccountId)) errors.push(`${l.label}: transfer için iki ayrı hesap seçilmeli.`)
    for (const id of l.transactionIds) { if (transactions.has(id)) errors.push('Bir gerçekleşen kayıt yalnızca bir kaleme bağlanabilir.'); transactions.add(id) }
  }
  return [...new Set(errors)]
}
export function reconcileLine(line: PlanLine, data: PlanData) {
  const direction = line.kind === 'collection' ? 'debit' : 'credit'
  const active = data.movements.filter(m => m.date <= data.today && !m.reversesId && !data.movements.some(r => r.reversesId === m.id && r.date <= data.today))
  if (line.kind === 'transfer') {
    const linked = active.filter(m => line.transactionIds.includes(m.id) && ((m.cashAccountId === line.accountId && m.credit > 0) || (m.cashAccountId === line.toAccountId && m.debit > 0)))
    const paid = money(Math.min(linked.filter(m => m.cashAccountId === line.accountId).reduce((n,m) => n+m.credit,0), linked.filter(m => m.cashAccountId === line.toAccountId).reduce((n,m) => n+m.debit,0)))
    return { paid, remaining: money(Math.max(0,line.amount-paid)), linked }
  }
  const linked = active.filter(m => line.transactionIds.includes(m.id) && m.cashAccountId === line.accountId && m[direction] > 0)
  const paid = money(linked.reduce((n, m) => n + m[direction], 0))
  return { paid, remaining: money(Math.max(0, line.amount - paid)), linked }
}
export function calculateReservePlan(plan: ReservePlan, data: PlanData, mode: 'included' | 'separate') {
  const warnings: string[] = []
  const balances = new Map(data.accounts.filter(a => a.currency === data.currency).map(a => [a.id, a.balance]))
  const cashOpening = plan.openingMode === 'excluded' ? 0 : plan.openingMode === 'manual' ? plan.openingCash : data.accounts.find(a => a.id === plan.cashAccountId)?.balanceReview ? null : balances.get(plan.cashAccountId ?? -1) ?? null
  const bankOpening = plan.bankScenario ?? (data.accounts.find(a => a.id === plan.bankAccountId)?.balanceReview ? null : balances.get(plan.bankAccountId ?? -1) ?? null)
  const cashKey = plan.cashAccountId ?? -1, bankKey = plan.bankAccountId ?? -2
  const projected = new Map<number, number>(balances)
  projected.set(cashKey, cashOpening ?? 0)
  projected.set(bankKey, bankOpening ?? 0)
  if (!plan.month) warnings.push('Plan ayı eksik; aylık tahmin onaylanamaz.')
  if (plan.reserve === null) warnings.push('Rezerv hedefi belirlenmedi')
  if (cashOpening === null || bankOpening === null) warnings.push('Başlangıç bakiyesi bilinmiyor.')
  for (const account of data.accounts.filter(a => a.balanceReview)) warnings.push(`${account.name}: kayıtlı bakiye ve hareket toplamı uyuşmuyor; güncel bakiye doğrulanmalı.`)
  if (plan.openingMode !== 'current' || plan.bankScenario !== null) warnings.push('Başlangıç bakiyeleri senaryo girdisidir; güncel mevcut bakiye değildir.')
  const rows = plan.lines.map(line => {
    const actual = reconcileLine(line, data)
    const offsets = line.kind === 'salary' ? plan.lines.filter(o => !o.deferred && o.kind === 'advanceOffset' && o.salaryId === line.id).reduce((n, o) => n + o.amount, 0) : 0
    const insurancePaid = mode === 'included' && line.id === plan.insuranceExpenseId ? plan.lines.filter(i => i.kind === 'insurance').reduce((n,i) => n + (i.deferred || (plan.month && i.date && !i.date.startsWith(plan.month)) ? i.amount : Math.min(i.amount, reconcileLine(i,data).paid)),0) : 0
    const remaining = money(Math.max(0, line.amount - offsets - actual.paid - insurancePaid))
    const inMonth = !plan.month || !line.date || line.date.startsWith(plan.month)
    const active = !line.deferred && inMonth && line.kind !== 'advanceOffset' && !(line.kind === 'insurance' && mode === 'included')
    if (line.assumption) warnings.push(`${line.label}: geçmiş kayıttan öneri, varsayım.`)
    if (remaining > 0 && !line.date && line.kind !== 'advanceOffset') warnings.push(`${line.label}: vade eksik.`)
    if (remaining > 0 && line.date && line.date < data.today) warnings.push(`${line.label}: ${line.kind === 'collection' ? 'tahsilat gecikti; tarih güncellenmeli' : 'ödeme gecikmiş'}.`)
    if (line.kind === 'insurance' && remaining > 0 && line.date && line.date >= data.today && line.date <= new Date(new Date(`${data.today}T12:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0,10)) warnings.push(`${line.label}: ödeme 7 gün içinde.`)
    if (active && remaining > 0 && line.accountId === null) warnings.push(`${line.label}: ödeme/tahsilat hesabı seçilmedi; hesap dağılımı varsayımdır.`)
    return { ...line, ...actual, remaining, active, offsets }
  })
  const accountOf = (l: PlanLine) => l.accountId ?? cashKey
  const collections = rows.filter(l => l.active && l.kind === 'collection').reduce((n,l) => n+l.remaining,0)
  const outflows = rows.filter(l => l.active && l.kind !== 'collection' && l.kind !== 'transfer').reduce((n,l) => n+l.remaining,0)
  for (const l of rows.filter(l => l.active)) {
    const id = accountOf(l)
    projected.set(id, money((projected.get(id) ?? 0) + (l.kind === 'collection' ? l.remaining : -l.remaining)))
    if (l.kind === 'transfer' && l.toAccountId) projected.set(l.toAccountId, money((projected.get(l.toAccountId) ?? 0) + l.remaining))
  }
  // Time-ordered liquidity uses only dated, not overdue, receipts. Undated money never funds an earlier payment.
  const timed = new Map<number, number>(balances)
  timed.set(cashKey, cashOpening ?? 0); timed.set(bankKey, bankOpening ?? 0)
  const calendarRows = rows.map(l => ({...l}))
  if (mode === 'included') {
    const bucket = calendarRows.find(l => l.id === plan.insuranceExpenseId)
    if (bucket && bucket.transactionIds.length > 0) warnings.push('Dahil sigorta: toplu giderin gerçekleşen ödemelerini detaylandırın; sigorta ödemesini kendi kalemine bağlayın.')
    if (bucket?.active) for (const insurance of rows.filter(l => l.kind === 'insurance' && !l.deferred && (!plan.month || !l.date || l.date.startsWith(plan.month)))) {
      const covered = Math.min(bucket.remaining, insurance.remaining)
      if (covered > 0 && insurance.date) {
        bucket.remaining = money(bucket.remaining - covered)
        calendarRows.push({...insurance, id: `${insurance.id}:included`, active: true, remaining: covered, accountId: bucket.accountId})
      }
    }
  }
  const schedule = calendarRows.filter(l => l.active && l.remaining > 0 && l.date && (l.kind !== 'collection' || l.date >= data.today))
    .sort((a,b) => a.date!.localeCompare(b.date!) || (a.kind === 'collection' ? 1 : 0) - (b.kind === 'collection' ? 1 : 0))
    .map(l => {
      const id = accountOf(l)
      timed.set(id, money((timed.get(id) ?? 0) + (l.kind === 'collection' ? l.remaining : -l.remaining)))
      if (l.kind === 'transfer' && l.toAccountId) timed.set(l.toAccountId, money((timed.get(l.toAccountId) ?? 0) + l.remaining))
      const accountShortfall = Math.max(0, -(timed.get(id) ?? 0))
      const reserveShortfall = plan.reserve === null ? null : Math.max(0, plan.reserve - (timed.get(cashKey) ?? 0))
      const dependencies = rows.filter(c => c.active && c.kind === 'collection' && c.remaining > 0 && (!c.date || c.date >= l.date! || c.date < data.today)).map(c => ({ label: c.label, amount: c.remaining, date: c.date }))
      if (l.kind !== 'collection' && accountShortfall > 0) warnings.push(`${l.label}: ödeme tarihinde ${money(accountShortfall)} DA hesap açığı.`)
      return { id: l.id, label: l.label, date: l.date, accountShortfall: money(accountShortfall), reserveShortfall: reserveShortfall === null ? null : money(reserveShortfall), dependencies }
    })
  const cash = money(projected.get(cashKey) ?? 0), bank = money(projected.get(bankKey) ?? 0)
  const total = money(cash + bank)
  const usable = money(cash + (plan.bankAvailable ? bank : 0))
  const reserveNeed = plan.reserve === null ? null : money(Math.max(0, plan.reserve - usable))
  const cashReserveGap = plan.reserve === null ? null : money(Math.max(0, plan.reserve - cash))
  const transferNeeded = plan.bankAvailable && cashReserveGap !== null ? money(Math.min(Math.max(0,bank),cashReserveGap)) : 0
  const deferredImpact = rows.filter(l => l.deferred && l.kind !== 'collection' && l.kind !== 'advanceOffset' && l.kind !== 'transfer' && !(mode === 'included' && l.kind === 'insurance' && rows.find(b => b.id === plan.insuranceExpenseId)?.deferred)).reduce((n,l) => n+l.remaining,0)
  const insurance = rows.filter(l => l.active && l.kind === 'insurance')
  const cashBeforeInsurance = money(cash + insurance.filter(l => accountOf(l) === cashKey).reduce((n,l) => n+l.remaining,0))
  const totalBeforeInsurance = money(total + insurance.reduce((n,l) => n+l.remaining,0))
  const cashFundingGap = money(Math.max(0,-cash))
  return { mode, reliableOpening: cashOpening !== null && bankOpening !== null, cashOpening, bankOpening, collections: money(collections), outflows: money(outflows), cash, bank, total, cashBeforeInsurance, totalBeforeInsurance, cashFundingGap, reserveNeed, cashReserveGap, transferNeeded, deferredImpact: money(deferredImpact), rows, schedule, warnings: [...new Set(warnings)] }
}
export function explainReservePlan(plan: ReservePlan, data: PlanData): string {
  const scenarios = (plan.insuranceMode === 'unknown' ? ['included','separate'] : [plan.insuranceMode]) as Array<'included'|'separate'>
  const f = (n: number) => `${n.toLocaleString('tr-TR')} DA`
  return scenarios.map(mode => {
    const r = calculateReservePlan(plan,data,mode)
    if (!r.reliableOpening) return [`${plan.month ?? 'Ay belirtilmedi'} — başlangıç bakiyesi eksik veya tutarsız; kesin tahmini bakiye ve rezerv açığı hesaplanmadı.`, ...r.warnings].join('\n')
    return [`${plan.month ?? 'Ay belirtilmedi'} — sigorta ${mode === 'included' ? 'toplam gidere dahil' : 'ayrı'}.`, `Tahsilatlar gerçekleşirse: beklenen kalan tahsilat ${f(r.collections)}, kalan plan gideri ${f(r.outflows)}.`, `Başlangıç kasası ${plan.openingMode === 'excluded' ? 'hariç' : 'dahil'}: ${r.cashOpening === null ? 'bilinmiyor' : f(r.cashOpening)}.`, `Hesap dağılımı ${plan.lines.some(l => l.accountId === null && l.kind !== 'advanceOffset') ? 'varsayım' : 'seçilen hesaplara göre'}: kasa ${f(r.cash)}, banka ${f(r.bank)}; toplam likidite ${f(r.total)} (kasa bakiyesi değildir).`, `Rezerv ${plan.reserve === null ? 'belirlenmedi' : f(plan.reserve)}; ek kaynak ihtiyacı ${r.reserveNeed === null ? 'hesaplanmadı' : f(r.reserveNeed)}.`, `Kasadaki rezerv açığı ${r.cashReserveGap === null ? 'hesaplanmadı' : f(r.cashReserveGap)}; banka kullanılabilir ${plan.bankAvailable ? 'evet' : 'hayır'}, gerekli banka→kasa transferi ${f(r.transferNeeded)} (henüz gerçekleşmedi).`, `Ertelenmiş giderlerin etkisi: ${f(r.deferredImpact)} daha az ödeme.`, ...r.schedule.filter(s => s.accountShortfall > 0 || (s.reserveShortfall ?? 0) > 0).map(s => `${s.date} ${s.label}: hesap açığı ${f(s.accountShortfall)}, kasa rezerv açığı ${f(s.reserveShortfall ?? 0)}. Henüz kullanılamayan tahsilatlar: ${s.dependencies.map(d=>`${d.label} ${f(d.amount)} (${d.date ?? 'vade eksik'})`).join(', ') || 'yok'}.`), ...r.warnings].join('\n')
  }).join('\n\n')
}
