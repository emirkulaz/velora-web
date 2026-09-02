const RECOVERY_ATTEMPT_KEY = 'vexor.error-recovery-attempted'

let recoveryInProgress = false

async function clearAppCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {
    // A reload is still useful when the browser blocks service-worker access.
  }

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
    }
  } catch {
    // Continue to the network reload even when cache deletion is unavailable.
  }
}

export async function recoverFromFatalClientError(): Promise<boolean> {
  if (recoveryInProgress || sessionStorage.getItem(RECOVERY_ATTEMPT_KEY)) {
    return false
  }

  recoveryInProgress = true
  sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, '1')
  await clearAppCaches()

  const url = new URL(window.location.href)
  url.searchParams.set('vexor-reload', String(Date.now()))
  window.location.replace(url.toString())
  return true
}

export function markClientStable(delayMs = 15_000) {
  window.setTimeout(() => {
    sessionStorage.removeItem(RECOVERY_ATTEMPT_KEY)
    recoveryInProgress = false
  }, delayMs)
}
