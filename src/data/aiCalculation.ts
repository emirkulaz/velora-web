/** Accept ungrouped decimals with either decimal separator. */
export function parseAiDecimal(value: string): number | null {
  const text = value.trim()
  if (!/^\d+(?:[.,]\d{1,4})?$/.test(text)) return null
  const number = Number(text.replace(',', '.'))
  return Number.isFinite(number) && number <= 1_000_000_000 ? number : null
}

// Four decimal places represented as integers avoid floating point rounding errors.
function scaled(value: string): bigint {
  const [whole, fraction = ''] = value.trim().replace(',', '.').split('.')
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'))
}
const roundedDivide = (value: bigint, divisor: bigint) => (value + divisor / 2n) / divisor
const money = (cents: bigint) => Number(cents) / 100
export const AI_COMMAND_LIMIT = 20000
export const AI_LINE_LIMIT = 10
export const quoteKeys = ['subtotal', 'discountAmount', 'net', 'taxAmount', 'total'] as const

export function calculateAiQuote(quantity: string, price: string, discount: string, tax: string) {
  const values = [quantity, price, discount, tax].map(parseAiDecimal)
  if (values.some((value) => value === null)) return null
  const [q, , d, t] = values as number[]
  if (q <= 0 || d > 100 || t > 100) return null
  const subtotal = roundedDivide(scaled(quantity) * scaled(price), 1000000n)
  const discountAmount = roundedDivide(subtotal * scaled(discount), 1000000n)
  const net = subtotal - discountAmount
  const taxAmount = roundedDivide(net * scaled(tax), 1000000n)
  const total = net + taxAmount
  if (subtotal > 100000000000n || total > 100000000000n) return null
  return { subtotal: money(subtotal), discountAmount: money(discountAmount), net: money(net), taxAmount: money(taxAmount), total: money(total) }
}

export function sumAiQuotes(results: ReturnType<typeof calculateAiQuote>[]) {
  if (!results.length || results.some((result) => !result)) return null
  const sum = { subtotal: 0, discountAmount: 0, net: 0, taxAmount: 0, total: 0 }
  for (const key of quoteKeys) {
    sum[key] = results.reduce((total, result) => total + Math.round(result![key] * 100), 0) / 100
    if (sum[key] > 1_000_000_000) return null
  }
  return sum
}

export type AiNumericField = 'quantity' | 'price' | 'discount' | 'tax'
export type AiFieldIssue = 'requiredField' | 'invalidNumber' | 'positiveQuantity' | 'invalidPercent'
export function validateAiField(field: AiNumericField, value: string): AiFieldIssue | null {
  if (!value.trim()) return 'requiredField'
  const number = parseAiDecimal(value)
  if (number === null) return 'invalidNumber'
  if (field === 'quantity' && number === 0) return 'positiveQuantity'
  if ((field === 'discount' || field === 'tax') && number > 100) return 'invalidPercent'
  return null
}
