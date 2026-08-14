export const OPEN_CUSTOMER_REQUEST_CREATE_FLAG =
  'velora.customerRequests.openCreate'

/** Requests the create modal to open when the customer requests view mounts. */
export function markOpenCustomerRequestCreate(): void {
  try {
    sessionStorage.setItem(OPEN_CUSTOMER_REQUEST_CREATE_FLAG, '1')
  } catch {
    // Storage can be unavailable in locked-down browser contexts.
  }
}
