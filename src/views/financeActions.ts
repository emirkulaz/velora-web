const OPEN_CASH_FLAG = 'velora.finance.openCash'
const OPEN_COLLECTION_FLAG = 'velora.finance.openCollection'

export function markOpenFinanceExpense(): void {
  try {
    sessionStorage.setItem(OPEN_CASH_FLAG, '1')
    sessionStorage.setItem('velora.finance.cashType', 'CASH_OUT')
  } catch { /* Storage is optional. */ }
}

export function markOpenFinanceCash(): void {
  try {
    sessionStorage.setItem(OPEN_CASH_FLAG, '1')
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export function markOpenFinanceCollection(): void {
  try {
    sessionStorage.setItem(OPEN_COLLECTION_FLAG, '1')
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}
