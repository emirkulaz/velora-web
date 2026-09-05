const RECOVERY_ATTEMPT_KEY = 'vexor.error-recovery-attempted'
const LOCAL_DEV_CLEANUP_KEY = 'vexor.local-dev-pwa-cleaned'
const VEXOR_CACHE_PATTERN = /(?:^|-)vexor(?:-|$)/i

let recoveryInProgress = false

export function isRecoverableChunkError(error: unknown): boolean {
  const value = error instanceof Error
    ? `${error.name} ${error.message}`
    : String(error ?? '')

  return /ChunkLoadError|Loading (?:CSS )?chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|vite:preloadError/i.test(value)
}

async function clearAppCaches() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const currentOrigin = window.location.origin
      await Promise.all(
        registrations
          .filter((registration) => new URL(registration.scope).origin === currentOrigin)
          .map((registration) => registration.unregister()),
      )
    }
  } catch {
    // A reload is still useful when the browser blocks service-worker access.
  }

  try {
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter((cacheName) => VEXOR_CACHE_PATTERN.test(cacheName))
          .map((cacheName) => caches.delete(cacheName)),
      )
    }
  } catch {
    // Continue to the network reload even when cache deletion is unavailable.
  }
}

/** Eski production PWA'sının Vite localhost oturumunu yönetmesini engeller. */
export async function prepareLocalDevelopmentRuntime(): Promise<boolean> {
  if (sessionStorage.getItem(LOCAL_DEV_CLEANUP_KEY)) return false

  sessionStorage.setItem(LOCAL_DEV_CLEANUP_KEY, '1')
  const wasControlled = Boolean(
    'serviceWorker' in navigator && navigator.serviceWorker.controller,
  )
  await clearAppCaches()

  if (!wasControlled) return false

  const url = new URL(window.location.href)
  url.searchParams.delete('vexor-reload')
  url.searchParams.set('vexor-dev-clean', '1')
  window.location.replace(url.toString())
  return true
}

export async function recoverFromFatalClientError(
  options: { force?: boolean } = {},
): Promise<boolean> {
  if (
    recoveryInProgress ||
    (!options.force && sessionStorage.getItem(RECOVERY_ATTEMPT_KEY))
  ) {
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
    const url = new URL(window.location.href)
    if (url.searchParams.has('vexor-reload') || url.searchParams.has('vexor-dev-clean')) {
      url.searchParams.delete('vexor-reload')
      url.searchParams.delete('vexor-dev-clean')
      window.history.replaceState(window.history.state, '', url)
    }
  }, delayMs)
}
