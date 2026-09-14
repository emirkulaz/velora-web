import { describe, expect, it } from 'vitest'
import { foldErpText, suggestErpSpelling } from './aiUnderstanding'
describe('multilingual ERP spelling suggestions', () => {
  it.each([
    ['kasdaa ne kadar var', 'kasada ne kadar var'],
    ['kasda ne kadar var', null],
    ['stok durumu', null],
    ['stok durumu müştrei', 'stok durumu müşteri'],
    ['combien dans la c esse', null],
    ['voir les factuers', 'voir les factures'],
    ['حالة المخزن', 'حالة المخزون'],
    ['SKU-123 ١٢٥ 10,50 DZD', null],
    ['müşteri Ahmet ürün ABC-42', null],
  ])('suggests conservatively for %s', (input, expected) => {
    expect(suggestErpSpelling(input)).toBe(expected)
  })
  it('folds accents and Arabic diacritics for comparison', () => {
    expect(foldErpText('MÜŞTERİ')).toBe('musteri')
    expect(foldErpText('إِنْتَاج')).toBe('انتاج')
  })
})
