import { algiersYmd } from './dates'
export type AiPeriod = 'auto' | 'today' | 'month' | 'previousMonth' | 'custom'
export interface AiDateRange { dateFrom?: string; dateTo?: string }
export function aiPeriodRange(period: AiPeriod, custom: AiDateRange, now = new Date()): AiDateRange {
  if (period === 'auto') return {}
  if (period === 'custom') return custom
  const today = algiersYmd(now)
  if (period === 'today') return { dateFrom: today, dateTo: today }
  if (period === 'month') return { dateFrom: `${today.slice(0, 7)}-01`, dateTo: today }
  const [year, month] = today.split('-').map(Number)
  const previousEnd = new Date(Date.UTC(year, month - 1, 0)).toISOString().slice(0, 10)
  return { dateFrom: `${previousEnd.slice(0, 7)}-01`, dateTo: previousEnd }
}
function validDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}
export function validAiDateRange(range: AiDateRange): boolean {
  if (range.dateFrom === undefined && range.dateTo === undefined) return true
  return validDate(range.dateFrom) && validDate(range.dateTo) && range.dateFrom! <= range.dateTo!
}
