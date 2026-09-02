export const CANONICAL_APP_ORIGIN = 'https://erpvexor.com'

export function getCanonicalRedirectUrl(
  currentHref: string,
  isProduction = import.meta.env.PROD,
): string | null {
  if (!isProduction) return null

  const current = new URL(currentHref)
  if (current.origin === CANONICAL_APP_ORIGIN) return null

  const isRailwayAddress =
    current.hostname.endsWith('.railway.app') ||
    current.hostname.endsWith('.up.railway.app')
  if (!isRailwayAddress) return null

  const canonical = new URL(CANONICAL_APP_ORIGIN)
  canonical.pathname = current.pathname
  canonical.search = current.search
  canonical.hash = current.hash
  return canonical.toString()
}
