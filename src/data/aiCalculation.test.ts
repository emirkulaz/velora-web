import { describe, expect, it } from 'vitest'
import { calculateAiQuote, parseAiDecimal, sumAiQuotes } from './aiCalculation'

describe('AI quote calculation', () => {
  it('accepts decimal comma and applies discount before tax', () => {
    expect(calculateAiQuote('2,5', '100.50', '10', '19')).toEqual({ subtotal: 251.25, discountAmount: 25.13, net: 226.12, taxAmount: 42.96, total: 269.08 })
  })
  it.each(['', '-1', 'NaN', '1.000,50', '1,000.50', '1e3', 'Infinity'])('rejects unsafe or ambiguous input %s', (value) => {
    expect(parseAiDecimal(value)).toBeNull()
  })
  it('rejects invalid quantities, percentages and oversized amounts', () => {
    expect(calculateAiQuote('0', '5', '0', '0')).toBeNull()
    expect(calculateAiQuote('1', '5', '101', '0')).toBeNull()
    expect(calculateAiQuote('1', '5', '0', '101')).toBeNull()
    expect(calculateAiQuote('1000000', '1000000', '0', '0')).toBeNull()
  })
  it('handles free items and full discounts', () => {
    expect(calculateAiQuote('1', '0', '0', '19')?.total).toBe(0)
    expect(calculateAiQuote('1', '100', '100', '19')?.total).toBe(0)
  })
})

it('rounds decimal midpoint amounts exactly and caps the tax-inclusive total', () => {
  expect(calculateAiQuote('1', '1.005', '0', '0')?.total).toBe(1.01)
  expect(calculateAiQuote('3', '0.335', '0', '0')?.total).toBe(1.01)
  expect(calculateAiQuote('1', '1000000000', '0', '1')).toBeNull()
})
it('sums rounded lines and rejects incomplete quotes', () => {
  expect(sumAiQuotes([calculateAiQuote('1', '0.1', '0', '0'), calculateAiQuote('1', '0.2', '0', '0')])?.total).toBe(0.3)
  expect(sumAiQuotes([calculateAiQuote('1', '5', '0', '0'), null])).toBeNull()
  expect(sumAiQuotes([])).toBeNull()
  expect(sumAiQuotes([calculateAiQuote('1', '600000000', '0', '0'), calculateAiQuote('1', '600000000', '0', '0')])).toBeNull()
})

