import { expect, it } from 'vitest'
import { aiPeriodRange, validAiDateRange } from './aiPeriod'
it('uses Algiers calendar dates at UTC day boundaries', () => {
  expect(aiPeriodRange('today', {}, new Date('2026-09-30T23:30:00Z'))).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-01' })
})
it('handles year boundaries and leap months', () => {
  expect(aiPeriodRange('previousMonth', {}, new Date('2026-01-15T12:00:00Z'))).toEqual({ dateFrom: '2025-12-01', dateTo: '2025-12-31' })
  expect(aiPeriodRange('previousMonth', {}, new Date('2024-03-10T12:00:00Z'))).toEqual({ dateFrom: '2024-02-01', dateTo: '2024-02-29' })
  expect(aiPeriodRange('month', {}, new Date('2026-10-15T12:00:00Z'))).toEqual({ dateFrom: '2026-10-01', dateTo: '2026-10-15' })
  expect(aiPeriodRange('auto', { dateFrom: '2026-01-01', dateTo: '2026-01-02' })).toEqual({})
})
it('rejects missing, impossible and reversed dates', () => {
  expect(validAiDateRange({})).toBe(true)
  expect(validAiDateRange({ dateFrom: '', dateTo: '' })).toBe(false)
  expect(validAiDateRange({ dateFrom: '2026-02-30', dateTo: '2026-03-05' })).toBe(false)
  expect(validAiDateRange({ dateFrom: '2026-10-10', dateTo: '2026-10-01' })).toBe(false)
  expect(validAiDateRange({ dateFrom: '2026-10-01', dateTo: '2026-10-01' })).toBe(true)
})
