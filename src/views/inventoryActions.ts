export const OPEN_INVENTORY_MOVEMENT_FLAG =
  'velora.inventory.openMovement'

/** Requests the stock movement modal to open when inventory mounts. */
export function markOpenInventoryMovement(): void {
  try {
    sessionStorage.setItem(OPEN_INVENTORY_MOVEMENT_FLAG, '1')
  } catch {
    // Storage can be unavailable in locked-down browser contexts.
  }
}
