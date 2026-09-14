/** Comparison only: never use folded text as a customer name, SKU or amount. */
export function foldErpText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f\u064b-\u065f\u0670\u0640]/g, '')
    .toLocaleLowerCase('tr').replace(/ı/g, 'i').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي')
}

const terms = [
  'kasa', 'kasada', 'stok', 'sipariş', 'tahsilat', 'müşteri', 'tedarikçi', 'üretim', 'borç', 'satış', 'fatura',
  'caisse', 'stock', 'commande', 'commandes', 'client', 'clients', 'fournisseur', 'fournisseurs', 'production', 'facture', 'factures', 'paiement', 'encaissement',
  'الصندوق', 'المخزون', 'مخزون', 'الطلبات', 'طلب', 'العملاء', 'عميل', 'الموردين', 'الإنتاج', 'الفواتير', 'فاتورة', 'الديون', 'تحصيل',
]
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) rows[i][0] = i
  for (let j = 0; j <= b.length; j++) rows[0][j] = j
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]))
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1)
  }
  return rows[a.length][b.length]
}
/** Optional draft suggestion only. Ambiguous matches and identifiers are left intact. */
export function suggestErpSpelling(input: string): string | null {
  const suggested = input.replace(/[\p{L}\p{M}\p{N}_-]+/gu, (word) => {
    if (/[\p{N}_-]/u.test(word)) return word
    const folded = foldErpText(word)
    if (folded.length < 4 || terms.some((term) => foldErpText(term) === folded)) return word
    const candidates = terms.filter((term) => {
      const target = foldErpText(term)
      return Math.abs(target.length - folded.length) <= 1 && /\p{Script=Arabic}/u.test(target) === /\p{Script=Arabic}/u.test(folded) && distance(folded, target) === 1
    })
    return candidates.length === 1 ? candidates[0] : word
  })
  return suggested === input ? null : suggested
}
