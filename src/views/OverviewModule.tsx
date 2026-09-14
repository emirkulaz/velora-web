import { useEffect, useState } from 'react'
import { ReportButton } from '../components/ReportButton'
import { apiGet } from '../data/api'
import { canAccessMenu, type AppUserRole } from '../data/roles'
import { OrderOverview } from './OrderOverview'
import type { MenuId } from '../data/types'
import { useI18n } from '../i18n/I18nProvider'

type Point = { date: string; value: number }
type Dashboard = {
  currency: string; date: string
  kpis: { todayRevenue:number; estimatedGrossProfit:number; profitCoverage:number; expenses:number; cashBalance:number; totalReceivable:number; totalPayable:number; totalSupplierDebt?:number; overdueSupplierDebt?:number; stockValue:number; openOrders:number; overdueOrders:number; inProduction:number }
  comparisons:{revenue30d:number|null;expense30d:number|null}
  charts: { sales:Point[]; collections?:Point[]; cashFlow:Array<{date:string;income:number;expense:number}>; topProducts:Array<{name:string;value:number}> }
  production:{completedToday:number;inProgress:number;completedQuantity:Record<string,number>}; alerts:Array<{severity:string;title:string;detail:string;target:'orders'|'inventory'}>; recent:Array<{id:string;at:string;type:string;title:string;amount:number;status:string}>; aiSummary:string
}

type NumberFormatter = (value: number, options?: Intl.NumberFormatOptions) => string
type CurrencyFormatter = (value: number, currency?: string) => string

const short = (v:number, formatNumber:NumberFormatter) => Math.abs(v)>=1_000_000 ? `${formatNumber(v/1_000_000,{maximumFractionDigits:1})}M` : Math.abs(v)>=1000 ? `${formatNumber(v/1000,{maximumFractionDigits:0})}K` : formatNumber(Math.round(v))

function LineChart({ data, currency, ariaLabel, formatNumber }: { data:Point[]; currency:string; ariaLabel:string; formatNumber:NumberFormatter }) {
  const w=720,h=230,p=32,max=Math.max(...data.map(d=>d.value),1)
  const last = Math.max(data.length - 1, 1)
  const points=data.map((d,i)=>`${p+(i/last)*(w-p*2)},${h-p-(d.value/max)*(h-p*2)}`).join(' ')
  const ticks = data.filter((_, i) => i === 0 || i === last || (i % 7 === 0 && i < last - 3))
  return <svg className="executive-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}><defs><linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2563eb" stopOpacity=".28"/><stop offset="1" stopColor="#2563eb" stopOpacity="0"/></linearGradient></defs>{[0,.25,.5,.75,1].map(x=><g key={x}><line x1={p} x2={w-p} y1={p+x*(h-p*2)} y2={p+x*(h-p*2)} className="chart-grid"/><text x={p-5} y={p+x*(h-p*2)+4} textAnchor="end">{short(max*(1-x),formatNumber)}</text></g>)}<polygon points={`${p},${h-p} ${points} ${w-p},${h-p}`} fill="url(#salesFill)"/><polyline points={points} className="chart-line"/>{ticks.map((d,i)=><text key={d.date} x={p+(data.indexOf(d)/last)*(w-p*2)} y={h-8} textAnchor={i===0?'start':i===ticks.length-1?'end':'middle'}>{d.date.slice(5).split('-').reverse().join('.')}</text>)}<text x={w-8} y={14} textAnchor="end" className="chart-unit">{currency}</text></svg>
}

function CashChart({ data, ariaLabel }: { data:Dashboard['charts']['cashFlow']; ariaLabel:string }) {
  const visible=data.slice(-14),w=720,h=230,p=32,max=Math.max(...visible.flatMap(d=>[d.income,d.expense]),1),group=(w-p*2)/Math.max(visible.length,1),bar=Math.max(4,group*.28)
  return <svg className="executive-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={ariaLabel}>{[0,.5,1].map(x=><line key={x} x1={p} x2={w-p} y1={p+x*(h-p*2)} y2={p+x*(h-p*2)} className="chart-grid"/>)}{visible.map((d,i)=>{const x=p+i*group+group/2,ih=d.income/max*(h-p*2),eh=d.expense/max*(h-p*2);return <g key={d.date}><rect x={x-bar-1} y={h-p-ih} width={bar} height={ih} rx="3" className="bar-income"/><rect x={x+1} y={h-p-eh} width={bar} height={eh} rx="3" className="bar-expense"/>{i%3===0&&<text x={x} y={h-8} textAnchor="middle">{d.date.slice(8)}</text>}</g>})}</svg>
}

function ProductBars({ data, currency, formatCurrency, emptyLabel }: { data:Dashboard['charts']['topProducts'];currency:string;formatCurrency:CurrencyFormatter;emptyLabel:string }) { const max=Math.max(...data.map(d=>d.value),1); return <div className="product-bars">{data.length?data.map((d,i)=><div className="product-bar" key={`${d.name}-${i}`}><div><span>{d.name}</span><strong>{formatCurrency(d.value,currency)}</strong></div><div className="product-bar__track"><span style={{width:`${Math.max(4,d.value/max*100)}%`}}/></div></div>):<p className="empty-state">{emptyLabel}</p>}</div> }

function ExecutiveOverview({ onNavigate }: { role?:AppUserRole|null; onNavigate?:(id:MenuId)=>void }) {
  const { t, formatCurrency, formatDate, formatNumber } = useI18n()
  const [data,setData]=useState<Dashboard|null>(null),[failed,setFailed]=useState(false),[loading,setLoading]=useState(true)
  useEffect(()=>{let live=true; apiGet<Dashboard>('/dashboard/executive').then(r=>{if(live)setData(r)}).catch(()=>{if(live)setFailed(true)}).finally(()=>{if(live)setLoading(false)}); return()=>{live=false}},[])
  const trendLabel=(value:number|null,reverse=false)=>value===null?t('overview.newPeriod'):`${value>0?'+':''}${formatNumber(value)}% ${reverse?(value<=0?t('overview.good'):t('overview.increase')):(value>=0?t('overview.increase'):t('overview.decrease'))}`
  const kpis=data?[
    {label:t('overview.todayRevenue'),value:formatCurrency(data.kpis.todayRevenue,data.currency),tone:'sales',meta:trendLabel(data.comparisons.revenue30d)},
    {label:t('overview.estimatedGrossProfit'),value:formatCurrency(data.kpis.estimatedGrossProfit,data.currency),tone:'profit',meta:t('overview.costCoverage',{value:data.kpis.profitCoverage})},
    {label:t('overview.todayExpense'),value:formatCurrency(data.kpis.expenses,data.currency),tone:'expense',meta:trendLabel(data.comparisons.expense30d,true)},
    {label:t('overview.totalCash'),value:formatCurrency(data.kpis.cashBalance,data.currency),tone:'income',meta:t('overview.activeCashAccounts')},
    {label:t('overview.customerReceivable'),value:formatCurrency(data.kpis.totalReceivable,data.currency),tone:'receivable',meta:t('overview.openLedgerBalance')},
    {label:t('overview.companyPayable'),value:formatCurrency(data.kpis.totalPayable,data.currency),tone:'payable',meta:t('overview.creditLedgers')},
    {label:t('overview.supplierDebt'),value:formatCurrency(data.kpis.totalSupplierDebt ?? 0,data.currency),tone:'payable',meta:t('overview.supplierRemaining')},
    {label:t('overview.overdueDebt'),value:formatCurrency(data.kpis.overdueSupplierDebt ?? 0,data.currency),tone:data.kpis.overdueSupplierDebt?'danger':'payable',meta:t('overview.goodsReceiptDueDates')},
    {label:t('overview.stockValue'),value:formatCurrency(data.kpis.stockValue,data.currency),tone:'stock',meta:t('overview.movementCosts')},
    {label:t('overview.overdueOrders'),value:formatNumber(data.kpis.overdueOrders),tone:data.kpis.overdueOrders?'danger':'orders',meta:t('overview.openOrdersCount',{value:formatNumber(data.kpis.openOrders)})},
  ]:[]
  if(loading)return <div className="executive-loading">{t('overview.loading')}</div>
  if(failed||!data)return <p className="demo-notice" role="alert">{failed?t('overview.loadError'):t('overview.noData')}</p>
  return <div className="executive-dashboard">
    <div className="executive-heading"><div><span className="executive-eyebrow">{t('overview.cockpit')} · {formatDate(`${data.date}T12:00:00`)}</span><h1>{t('overview.headline')}</h1><p>{t('overview.description')}</p></div><ReportButton type="daily-summary" label={t('overview.dailyReport')}/></div>
    <section className="executive-kpis">{kpis.map(k=><article className={`executive-kpi executive-kpi--${k.tone}`} key={k.label}><span>{k.label}</span><strong>{k.value}</strong><small>{k.meta}</small></article>)}</section>
    <section className="executive-operation-strip"><div><span>{t('overview.inProduction')}</span><strong>{formatNumber(data.kpis.inProduction)}</strong><small>{t('overview.activeJobs')}</small></div><div><span>{t('overview.completedToday')}</span><strong>{formatNumber(data.production.completedToday)}</strong><small>{t('overview.productionOrder')}</small></div><div><span>{t('overview.openOrders')}</span><strong>{formatNumber(data.kpis.openOrders)}</strong><small>{t('overview.tracked')}</small></div><div className={data.kpis.overdueOrders?'is-critical':''}><span>{t('overview.overdue')}</span><strong>{formatNumber(data.kpis.overdueOrders)}</strong><small>{t('overview.actionRequired')}</small></div></section>
    <section className="executive-charts"><article className="executive-panel executive-panel--wide"><header><div><span>{t('overview.customerCollections')}</span><h2>{t('overview.collectionTrend')}</h2></div><strong>{formatCurrency((data.charts.collections ?? data.charts.sales).reduce((s,d)=>s+d.value,0),data.currency)}</strong></header><LineChart data={data.charts.collections ?? data.charts.sales} currency={data.currency} ariaLabel={t('overview.collectionChart')} formatNumber={formatNumber}/></article><article className="executive-panel"><header><div><span>{t('overview.cashMovement')}</span><h2>{t('overview.collectionsExpenses')}</h2></div><div className="chart-legend"><i className="legend-income"/>{t('overview.collection')} <i className="legend-expense"/>{t('overview.expense')}</div></header><CashChart data={data.charts.cashFlow} ariaLabel={t('overview.cashChart')}/></article><article className="executive-panel"><header><div><span>{t('overview.productPerformance')}</span><h2>{t('overview.topProducts')}</h2></div></header><ProductBars data={data.charts.topProducts} currency={data.currency} formatCurrency={formatCurrency} emptyLabel={t('overview.noProductSales')}/></article></section>
    <section className="executive-bottom"><article className="executive-panel"><header><div><span>{t('overview.liveFlow')}</span><h2>{t('overview.recentActivity')}</h2></div></header><div className="activity-list">{data.recent.map(r=><button key={r.id} type="button" onClick={()=>onNavigate?.(r.type==='Sipariş'?'orders':r.type==='Gider'||r.type==='Tahsilat'?'finance':'overview')}><span className={`activity-dot activity-dot--${r.type.toLocaleLowerCase('tr-TR')}`}/><span><strong>{r.title}</strong><small>{r.type} · {formatDate(r.at)}</small></span><b className={r.amount<0?'negative':''}>{formatCurrency(r.amount,data.currency)}</b></button>)}</div></article><article className="executive-panel"><header><div><span>{t('overview.needsAttention')}</span><h2>{t('overview.managementAlerts')}</h2></div><b className="alert-count">{formatNumber(data.alerts.length)}</b></header><div className="alert-list">{data.alerts.length?data.alerts.map((a,i)=><button key={i} className={a.severity==='critical'?'is-critical':''} onClick={()=>onNavigate?.(a.target)}><span>!</span><div><strong>{a.title}</strong><small>{a.detail}</small></div></button>):<p className="empty-state">{t('overview.noCriticalAlerts')}</p>}</div></article></section>
    <section className="ai-daily-summary"><div className="ai-daily-summary__mark">V</div><div><span>{t('overview.aiSummary')}</span><h2>{data.aiSummary}</h2><p>{t('overview.source',{date:formatDate(`${data.date}T12:00:00`)})}</p></div><button onClick={()=>document.querySelector<HTMLTextAreaElement>('.ai-command__input')?.focus()}>{t('overview.askVexor')}</button></section>
  </div>
}

export function OverviewModule({ role, onNavigate }: { role?:AppUserRole|null; onNavigate?:(id:MenuId)=>void }) {
  return canAccessMenu(role, 'orders') ? <OrderOverview onNavigate={onNavigate} /> : <ExecutiveOverview onNavigate={onNavigate} />
}
