import { describe, expect, it } from 'vitest'
import { calculateReservePlan, explainReservePlan, initialReservePlan, validateReservePlan, type PlanData } from './reservePlan'
const data: PlanData = { accounts: [{id:1,name:'Kasa',currency:'DZD',balance:500},{id:2,name:'Banka',currency:'DZD',balance:100000}], movements: [], today:'2026-10-02', currency:'DZD' }
function plan() { const p=initialReservePlan(); p.month='2026-10'; p.reserve=50000; p.bankAvailable=true; p.cashAccountId=1; p.bankAccountId=2; p.lines=p.lines.map(l=>({...l,accountId:1})); return p }
describe('monthly reserve planning',()=>{
  it('matches separate insurance control without merging cash and bank',()=>{
    const r=calculateReservePlan(plan(),data,'separate')
    expect(r.collections).toBe(420310); expect(r.outflows).toBe(490200)
    expect(r.cash).toBe(-69890); expect(r.bank).toBe(100000)
    expect(r.total).toBe(30110); expect(r.reserveNeed).toBe(19890)
    expect(r.cashBeforeInsurance).toBe(86110); expect(r.totalBeforeInsurance).toBe(186110); expect(r.cashFundingGap).toBe(69890)
    expect(r.transferNeeded).toBe(100000); expect(r.cashReserveGap).toBe(119890)
  })
  it('supports 500 DA opening cash and included insurance without double deduction',()=>{
    const p=plan(); p.openingMode='manual'
    expect(calculateReservePlan(p,data,'separate').total).toBe(30610)
    expect(calculateReservePlan(p,data,'included').cash).toBe(86610)
    p.openingMode='excluded'
    expect(calculateReservePlan(p,data,'included').cash).toBe(86110)
    expect(calculateReservePlan(p,data,'included').outflows).toBe(334200)
  })
  it('defaults to October 2026 without inventing a reserve or insurance due date',()=>{
    const p=initialReservePlan(); expect(p.reserve).toBeNull(); expect(p.month).toBe('2026-10'); expect(p.lines[3].date).toBeNull()
    const r=calculateReservePlan(p,data,'separate'); expect(r.reserveNeed).toBeNull()
    expect(r.warnings).toContain('Rezerv hedefi belirlenmedi')
    const text=explainReservePlan(p,data); expect(text).toContain('sigorta toplam gidere dahil'); expect(text).toContain('sigorta ayrı'); expect(text).toContain('güncel mevcut bakiye değildir')
  })
  it('uses only the remaining collection after actual partial receipt',()=>{
    const p=plan(); p.openingMode='current'; p.bankScenario=null; p.lines[0].transactionIds=[10]
    const actual={...data,accounts:[{...data.accounts[0],balance:50500},data.accounts[1]],movements:[{id:10,cashAccountId:1,debit:50000,credit:0,date:'2026-10-02',reversesId:null}]}
    const r=calculateReservePlan(p,actual,'separate'); expect(r.collections).toBe(370310); expect(r.total).toBe(30610)
    expect(r.rows[0].paid).toBe(50000); expect(r.rows[0].remaining).toBe(76310)
  })
  it('does not deduct paid insurance again and removes due warnings',()=>{
    const p=plan(); p.openingMode='current'; p.lines[3].date='2026-10-01'; p.lines[3].transactionIds=[11]
    const actual={...data,movements:[{id:11,cashAccountId:1,debit:0,credit:156000,date:'2026-10-01',reversesId:null}]}
    const r=calculateReservePlan(p,actual,'separate'); expect(r.outflows).toBe(334200); expect(r.rows[3].remaining).toBe(0); expect(r.warnings.some(w=>w.startsWith('Sigorta:'))).toBe(false)
  })
  it('reactivates reversed payments',()=>{
    const p=plan(); p.lines[3].transactionIds=[11]
    const actual={...data,movements:[{id:11,cashAccountId:1,debit:0,credit:156000,date:'2026-10-01',reversesId:null},{id:12,cashAccountId:1,debit:156000,credit:0,date:'2026-10-02',reversesId:11}]}
    expect(calculateReservePlan(p,actual,'separate').rows[3].remaining).toBe(156000)
  })
  it('reduces the included aggregate by already-paid insurance exactly once',()=>{
    const p=plan(); p.lines[3].transactionIds=[11]
    const actual={...data,movements:[{id:11,cashAccountId:1,debit:0,credit:156000,date:'2026-10-01',reversesId:null}]}
    const r=calculateReservePlan(p,actual,'included'); expect(r.outflows).toBe(178200); expect(r.rows[3].remaining).toBe(0)
  })
  it('uses included insurance due date without scheduling it twice',()=>{
    const p=plan(); p.lines[3].date='2026-10-05'; p.lines[2].date='2026-10-10'
    const r=calculateReservePlan(p,data,'included'); expect(r.outflows).toBe(334200)
    expect(r.schedule).toHaveLength(2); expect(r.schedule[0].accountShortfall).toBe(156000); expect(r.schedule[1].accountShortfall).toBe(334200)
  })
  it('cannot fund a payment with undated, same-day or later receipts',()=>{
    const p=plan(); p.lines[2].date='2026-10-05'; p.lines[0].date='2026-10-06'; p.lines[1].date=null
    let r=calculateReservePlan(p,data,'separate'); expect(r.schedule[0].accountShortfall).toBe(334200); expect(r.schedule[0].dependencies).toHaveLength(2)
    p.lines[0].date='2026-10-05'; r=calculateReservePlan(p,data,'separate'); expect(r.schedule[0].label).toContain('gider'); expect(r.schedule[0].accountShortfall).toBe(334200)
  })
  it('overdue collections are not treated as available on the payment date',()=>{
    const p=plan(); p.lines[0].date='2026-10-01'; p.lines[1].date='2026-10-03'; p.lines[2].date='2026-10-04'
    const r=calculateReservePlan(p,data,'separate'); expect(r.schedule.find(s=>s.id==='expenses')?.accountShortfall).toBe(40200); expect(r.warnings.some(w=>w.includes('tahsilat gecikti'))).toBe(true)
  })
  it('reports missing, approaching and overdue insurance due dates',()=>{
    const p=plan(); expect(calculateReservePlan(p,data,'separate').warnings).toContain('Sigorta: vade eksik.')
    p.lines[3].date='2026-10-08'; expect(calculateReservePlan(p,data,'separate').warnings).toContain('Sigorta: ödeme 7 gün içinde.')
    p.lines[3].date='2026-10-01'; expect(calculateReservePlan(p,data,'separate').warnings).toContain('Sigorta: ödeme gecikmiş.')
  })
  it('isolates months and quantifies deferral',()=>{
    const p=plan(); p.lines[2].date='2026-11-01'; expect(calculateReservePlan(p,data,'separate').outflows).toBe(156000)
    p.lines[2].date='2026-10-10'; p.lines[2].deferred=true
    const r=calculateReservePlan(p,data,'separate'); expect(r.deferredImpact).toBe(334200); expect(r.outflows).toBe(156000)
  })
  it('deducts advances from salary rather than making another cash outflow',()=>{
    const p=plan(); p.lines=[{...p.lines[2],id:'salary',kind:'salary',amount:60000},{...p.lines[2],id:'advance',kind:'advanceOffset',salaryId:'salary',amount:10000}]
    expect(calculateReservePlan(p,data,'separate').outflows).toBe(50000)
  })
  it('requires an explicit transfer to replenish cash',()=>{
    const p=plan(); p.lines=[{...p.lines[2],amount:60000,date:'2026-10-04'},{...p.lines[2],id:'transfer',kind:'transfer',amount:80000,accountId:2,toAccountId:1,date:'2026-10-03'}]
    const r=calculateReservePlan(p,data,'separate'); expect(r.cash).toBe(20000); expect(r.bank).toBe(20000); expect(r.total).toBe(40000); expect(r.schedule[1].accountShortfall).toBe(0)
  })
  it('validates dates, duplicate posting links and separate accounts',()=>{
    const p=plan(); p.cashAccountId=2; p.lines[0].date='2026-02-30'; p.lines[0].transactionIds=[1]; p.lines[1].transactionIds=[1]
    const errors=validateReservePlan(p); expect(errors).toContain('Kasa ve banka ayrı hesaplar olmalı.'); expect(errors.some(e=>e.includes('tarih geçersiz'))).toBe(true); expect(errors.some(e=>e.includes('yalnızca bir kaleme'))).toBe(true)
  })
  it('bank unavailability increases required external funding',()=>{
    const p=plan(); p.bankAvailable=false
    const r=calculateReservePlan(p,data,'separate'); expect(r.reserveNeed).toBe(119890); expect(r.transferNeeded).toBe(0)
  })
  it('deferring included insurance reduces its aggregate once',()=>{
    const p=plan(); p.lines[3].deferred=true
    const r=calculateReservePlan(p,data,'included'); expect(r.outflows).toBe(178200); expect(r.deferredImpact).toBe(156000)
  })
  it('does not accept future postings as realized money',()=>{
    const p=plan(); p.lines[0].transactionIds=[10]
    const r=calculateReservePlan(p,{...data,movements:[{id:10,cashAccountId:1,debit:126310,credit:0,date:'2026-11-01',reversesId:null}]},'separate')
    expect(r.rows[0].paid).toBe(0); expect(r.collections).toBe(420310)
  })
  it('withholds conclusions when stored and ledger balances conflict',()=>{
    const p=plan(); p.openingMode='current'
    const inconsistent={...data,accounts:[{...data.accounts[0],balanceReview:true,recordedBalance:225532},data.accounts[1]]}
    expect(calculateReservePlan(p,inconsistent,'separate').reliableOpening).toBe(false)
    expect(explainReservePlan(p,inconsistent)).toContain('hesaplanmadı')
  })
  it('does not replay already-realized paired transfers',()=>{
    const p=plan(); p.openingMode='current'; p.bankScenario=null; p.lines=[{...p.lines[2],id:'transfer',kind:'transfer',amount:80000,accountId:2,toAccountId:1,transactionIds:[10,11]}]
    const actual={...data,accounts:[{...data.accounts[0],balance:80500},{...data.accounts[1],balance:20000}],movements:[{id:10,cashAccountId:2,debit:0,credit:80000,date:'2026-10-01',reversesId:null},{id:11,cashAccountId:1,debit:80000,credit:0,date:'2026-10-01',reversesId:null}]}
    const r=calculateReservePlan(p,actual,'separate'); expect(r.rows[0].remaining).toBe(0); expect(r.cash).toBe(80500); expect(r.bank).toBe(20000)
  })
})
