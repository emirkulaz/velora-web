import { useEffect, useMemo, useState } from 'react'
import { ReportButton } from '../components/ReportButton'
import { apiGet } from '../data/api'
import type { AppUserRole } from '../data/roles'
import type { MenuId } from '../data/types'

type Point = { date: string; value: number }
type Dashboard = {
  currency: string; date: string
  kpis: { todayRevenue:number; estimatedGrossProfit:number; profitCoverage:number; expenses:number; cashBalance:number; totalReceivable:number; totalPayable:number; totalSupplierDebt?:number; overdueSupplierDebt?:number; stockValue:number; openOrders:number; overdueOrders:number; inProduction:number }
  comparisons:{revenue30d:number|null;expense30d:number|null}
  charts: { sales:Point[]; collections?:Point[]; cashFlow:Array<{date:string;income:number;expense:number}>; topProducts:Array<{name:string;value:number}> }
  production:{completedToday:number;inProgress:number;completedQuantity:Record<string,number>}; alerts:Array<{severity:string;title:string;detail:string;target:'orders'|'inventory'}>; recent:Array<{id:string;at:string;type:string;title:string;amount:number;status:string}>; aiSummary:string
}

const money = (v:number,c='DZD') => `${v.toLocaleString('fr-DZ',{maximumFractionDigits:0})} ${c}`
const short = (v:number) => Math.abs(v)>=1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : Math.abs(v)>=1000 ? `${(v/1000).toFixed(0)}K` : String(Math.round(v))

function LineChart({ data, currency }: { data:Point[]; currency:string }) {
  const w=720,h=230,p=32,max=Math.max(...data.map(d=>d.value),1)
  const last = Math.max(data.length - 1, 1)
  const points=data.map((d,i)=>`${p+(i/last)*(w-p*2)},${h-p-(d.value/max)*(h-p*2)}`).join(' ')
  const ticks = data.filter((_, i) => i === 0 || i === last || (i % 7 === 0 && i < last - 3))
  return <svg className="executive-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Son 30 günlük müşteri tahsilatı"><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".28"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs>{[0,.25,.5,.75,1].map(x=><g key={x}><line x1={p} x2={w-p} y1={p+x*(h-p*2)} y2={p+x*(h-p*2)} className="chart-grid"/><text x={p-5} y={p+x*(h-p*2)+4} textAnchor="end">{short(max*(1-x))}</text></g>)}<polygon points={`${p},${h-p} ${points} ${w-p},${h-p}`} fill="url(#salesFill)"/><polyline points={points} className="chart-line"/>{ticks.map((d,i)=><text key={d.date} x={p+(data.indexOf(d)/last)*(w-p*2)} y={h-8} textAnchor={i===0?'start':i===ticks.length-1?'end':'middle'}>{d.date.slice(5).split('-').reverse().join('.')}</text>)}<text x={w-8} y={14} textAnchor="end" className="chart-unit">{currency}</text></svg>
}

function CashChart({ data }: { data:Dashboard['charts']['cashFlow'] }) {
  const visible=data.slice(-14),w=720,h=230,p=32,max=Math.max(...visible.flatMap(d=>[d.income,d.expense]),1),group=(w-p*2)/Math.max(visible.length,1),bar=Math.max(4,group*.28)
  return <svg className="executive-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Tahsilat ve gider grafiği">{[0,.5,1].map(x=><line key={x} x1={p} x2={w-p} y1={p+x*(h-p*2)} y2={p+x*(h-p*2)} className="chart-grid"/>)}{visible.map((d,i)=>{const x=p+i*group+group/2,ih=d.income/max*(h-p*2),eh=d.expense/max*(h-p*2);return <g key={d.date}><rect x={x-bar-1} y={h-p-ih} width={bar} height={ih} rx="3" className="bar-income"/><rect x={x+1} y={h-p-eh} width={bar} height={eh} rx="3" className="bar-expense"/>{i%3===0&&<text x={x} y={h-8} textAnchor="middle">{d.date.slice(8)}</text>}</g>})}</svg>
}

function ProductBars({ data, currency }: { data:Dashboard['charts']['topProducts'];currency:string }) { const max=Math.max(...data.map(d=>d.value),1); return <div className="product-bars">{data.length?data.map((d,i)=><div className="product-bar" key={`${d.name}-${i}`}><div><span>{d.name}</span><strong>{money(d.value,currency)}</strong></div><div className="product-bar__track"><span style={{width:`${Math.max(4,d.value/max*100)}%`}}/></div></div>):<p className="empty-state">Ürün bağlantılı satış verisi yok.</p>}</div> }

const trendLabel=(value:number|null,reverse=false)=>value===null?'Yeni dönem':`${value>0?'+':''}${value.toLocaleString('tr-TR')}% ${reverse?(value<=0?'iyi':'artış'):(value>=0?'artış':'düşüş')}`

export function OverviewModule({ role: _role, onNavigate }: { role?:AppUserRole|null; onNavigate?:(id:MenuId)=>void }) {
  const [data,setData]=useState<Dashboard|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true)
  useEffect(()=>{let live=true; apiGet<Dashboard>('/dashboard/executive').then(r=>{if(live)setData(r)}).catch(()=>{if(live)setError('Yönetici dashboard verileri alınamadı.')}).finally(()=>{if(live)setLoading(false)}); return()=>{live=false}},[])
  const kpis=useMemo(()=>data?[
    {label:'Bugünkü Ciro',value:money(data.kpis.todayRevenue,data.currency),tone:'sales',meta:trendLabel(data.comparisons.revenue30d)},
    {label:'Tahmini Brüt Kâr',value:money(data.kpis.estimatedGrossProfit,data.currency),tone:'profit',meta:`Maliyet kapsamı %${data.kpis.profitCoverage}`},
    {label:'Bugünkü Gider',value:money(data.kpis.expenses,data.currency),tone:'expense',meta:trendLabel(data.comparisons.expense30d,true)},
    {label:'Toplam Nakit',value:money(data.kpis.cashBalance,data.currency),tone:'income',meta:'Aktif kasa hesapları'},
    {label:'Müşteri Alacağı',value:money(data.kpis.totalReceivable,data.currency),tone:'receivable',meta:'Açık cari bakiye'},
    {label:'Şirket Borcu',value:money(data.kpis.totalPayable,data.currency),tone:'payable',meta:'Alacak bakiyeli cariler'},
    {label:'Toplam tedarikçi borcu',value:money(data.kpis.totalSupplierDebt ?? 0,data.currency),tone:'payable',meta:'SupplierLedger kalan'},
    {label:'Vadesi geçmiş borç',value:money(data.kpis.overdueSupplierDebt ?? 0,data.currency),tone:data.kpis.overdueSupplierDebt?'danger':'payable',meta:'Mal kabul vadeleri'},
    {label:'Stok Değeri',value:money(data.kpis.stockValue,data.currency),tone:'stock',meta:'Hareket maliyetleriyle'},
    {label:'Geciken Sipariş',value:String(data.kpis.overdueOrders),tone:data.kpis.overdueOrders?'danger':'orders',meta:`${data.kpis.openOrders} açık sipariş`},
  ]:[],[data])
  if(loading)return <div className="executive-loading">Şirket görünümü hazırlanıyor…</div>
  if(error||!data)return <p className="demo-notice" role="alert">{error||'Dashboard verisi bulunamadı.'}</p>
  return <div className="executive-dashboard">
    <div className="executive-heading"><div><span className="executive-eyebrow">YÖNETİCİ KOKPİTİ · {data.date.split('-').reverse().join('.')}</span><h1>Şirketin nabzı, tek ekranda.</h1><p>Cirodan geciken siparişlere kadar karar vermeniz gereken her şey.</p></div><ReportButton type="daily-summary" label="Günlük Genel Rapor"/></div>
    <section className="executive-kpis">{kpis.map(k=><article className={`executive-kpi executive-kpi--${k.tone}`} key={k.label}><span>{k.label}</span><strong>{k.value}</strong><small>{k.meta}</small></article>)}</section>
    <section className="executive-operation-strip"><div><span>Üretimde</span><strong>{data.kpis.inProduction}</strong><small>aktif iş</small></div><div><span>Bugün tamamlanan</span><strong>{data.production.completedToday}</strong><small>üretim emri</small></div><div><span>Açık sipariş</span><strong>{data.kpis.openOrders}</strong><small>takipte</small></div><div className={data.kpis.overdueOrders?'is-critical':''}><span>Geciken</span><strong>{data.kpis.overdueOrders}</strong><small>müdahale gerekli</small></div></section>
    <section className="executive-charts"><article className="executive-panel executive-panel--wide"><header><div><span>Müşteri tahsilatı</span><h2>30 günlük tahsilat trendi</h2></div><strong>{money((data.charts.collections ?? data.charts.sales).reduce((s,d)=>s+d.value,0),data.currency)}</strong></header><LineChart data={data.charts.collections ?? data.charts.sales} currency={data.currency}/></article><article className="executive-panel"><header><div><span>Nakit hareketi</span><h2>Tahsilat / gider</h2></div><div className="chart-legend"><i className="legend-income"/>Tahsilat <i className="legend-expense"/>Gider</div></header><CashChart data={data.charts.cashFlow}/></article><article className="executive-panel"><header><div><span>Ürün performansı</span><h2>En çok ciro yapan ürünler</h2></div></header><ProductBars data={data.charts.topProducts} currency={data.currency}/></article></section>
    <section className="executive-bottom"><article className="executive-panel"><header><div><span>Canlı akış</span><h2>Son hareketler</h2></div></header><div className="activity-list">{data.recent.map(r=><button key={r.id} type="button" onClick={()=>onNavigate?.(r.type==='Sipariş'?'orders':r.type==='Gider'||r.type==='Tahsilat'?'finance':'overview')}><span className={`activity-dot activity-dot--${r.type.toLocaleLowerCase('tr-TR')}`}/><span><strong>{r.title}</strong><small>{r.type} · {new Date(r.at).toLocaleDateString('tr-TR')}</small></span><b className={r.amount<0?'negative':''}>{money(r.amount,data.currency)}</b></button>)}</div></article><article className="executive-panel"><header><div><span>Dikkat gerektirenler</span><h2>Yönetici uyarıları</h2></div><b className="alert-count">{data.alerts.length}</b></header><div className="alert-list">{data.alerts.length?data.alerts.map((a,i)=><button key={i} className={a.severity==='critical'?'is-critical':''} onClick={()=>onNavigate?.(a.target)}><span>!</span><div><strong>{a.title}</strong><small>{a.detail}</small></div></button>):<p className="empty-state">Kritik uyarı yok.</p>}</div></article></section>
    <section className="ai-daily-summary"><div className="ai-daily-summary__mark">V</div><div><span>VEXOR AI · BUGÜNÜN ÖZETİ</span><h2>{data.aiSummary}</h2><p>Kaynak: VEXOR şirket verileri · {data.date.split('-').reverse().join('.')}</p></div><button onClick={()=>document.querySelector<HTMLTextAreaElement>('.ai-command__input')?.focus()}>VEXOR’a sor →</button></section>
  </div>
}
