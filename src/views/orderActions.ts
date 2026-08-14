export const OPEN_ORDER_CREATE_FLAG = 'velora.orders.openCreate'

/** Requests the create modal to open when the orders view mounts. */
export function markOpenOrderCreate(): void {
  try {
    sessionStorage.setItem(OPEN_ORDER_CREATE_FLAG, '1')
  } catch {
    // Storage can be unavailable in locked-down browser contexts.
  }
}
