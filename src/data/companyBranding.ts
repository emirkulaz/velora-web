export type SectorPack = 'GENERIC' | 'TEXTILE'

export interface CompanyPresentation {
  companyId: number
  name: string
  currency: string
  logo: string | null
  sectorPack: SectorPack
}

interface CompanyApiResponse {
  id: number
  name: string
  currency: string
  logo: string | null
  sectorPack?: SectorPack
}

const LAST_COMPANY_PRESENTATION_KEY = 'velora.lastCompanyPresentation'
const TRIKOMEX_COMPANY_NAME = 'TRIKOMEX Textile'

function isSectorPack(value: unknown): value is SectorPack {
  return value === 'GENERIC' || value === 'TEXTILE'
}

function resolveSectorPack(
  sectorPack: unknown,
  companyName: string,
): SectorPack {
  if (isSectorPack(sectorPack)) {
    return sectorPack
  }

  // Legacy localStorage / older API responses before sectorPack existed.
  return companyName === TRIKOMEX_COMPANY_NAME ? 'TEXTILE' : 'GENERIC'
}

function isCompanyPresentation(value: unknown): value is CompanyPresentation {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const company = value as Record<string, unknown>

  return (
    typeof company.companyId === 'number' &&
    Number.isInteger(company.companyId) &&
    company.companyId > 0 &&
    typeof company.name === 'string' &&
    company.name.length > 0 &&
    typeof company.currency === 'string' &&
    company.currency.length > 0 &&
    (typeof company.logo === 'string' || company.logo === null) &&
    isSectorPack(company.sectorPack)
  )
}

function toCompanyPresentation(value: unknown): CompanyPresentation | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }

  const company = value as Partial<CompanyApiResponse>

  if (
    typeof company.id !== 'number' ||
    !Number.isInteger(company.id) ||
    company.id <= 0 ||
    typeof company.name !== 'string' ||
    company.name.length === 0 ||
    typeof company.currency !== 'string' ||
    company.currency.length === 0 ||
    (typeof company.logo !== 'string' && company.logo !== null)
  ) {
    return null
  }

  return {
    companyId: company.id,
    name: company.name,
    currency: company.currency,
    logo: company.logo,
    sectorPack: resolveSectorPack(company.sectorPack, company.name),
  }
}

export function readLastCompanyPresentation(): CompanyPresentation | null {
  const storedPresentation = localStorage.getItem(LAST_COMPANY_PRESENTATION_KEY)

  if (!storedPresentation) {
    return null
  }

  try {
    const presentation: unknown = JSON.parse(storedPresentation)

    if (isCompanyPresentation(presentation)) {
      return presentation
    }

    // Upgrade legacy cache entries that omit sectorPack.
    if (
      typeof presentation === 'object' &&
      presentation !== null &&
      'companyId' in presentation &&
      'name' in presentation
    ) {
      const legacy = presentation as {
        companyId: number
        name: string
        currency: string
        logo: string | null
        sectorPack?: unknown
      }

      if (
        typeof legacy.companyId === 'number' &&
        typeof legacy.name === 'string' &&
        typeof legacy.currency === 'string' &&
        (typeof legacy.logo === 'string' || legacy.logo === null)
      ) {
        const upgraded: CompanyPresentation = {
          companyId: legacy.companyId,
          name: legacy.name,
          currency: legacy.currency,
          logo: legacy.logo,
          sectorPack: resolveSectorPack(legacy.sectorPack, legacy.name),
        }
        localStorage.setItem(LAST_COMPANY_PRESENTATION_KEY, JSON.stringify(upgraded))
        return upgraded
      }
    }
  } catch {
    // Ignore stale or malformed browser storage.
  }

  localStorage.removeItem(LAST_COMPANY_PRESENTATION_KEY)
  return null
}

export function rememberCompanyPresentation(company: unknown): CompanyPresentation | null {
  const presentation = toCompanyPresentation(company)

  if (!presentation) {
    return null
  }

  localStorage.setItem(LAST_COMPANY_PRESENTATION_KEY, JSON.stringify(presentation))
  return presentation
}

export function clearLastCompanyPresentation() {
  localStorage.removeItem(LAST_COMPANY_PRESENTATION_KEY)
}

export function isRememberedTrikomex(
  presentation: CompanyPresentation | null,
): presentation is CompanyPresentation {
  return presentation?.name === TRIKOMEX_COMPANY_NAME
}

export function isTextileCompany(
  presentation: CompanyPresentation | null | undefined,
): boolean {
  return presentation?.sectorPack === 'TEXTILE'
}

/** API logo yoksa TRIKOMEX için yerel marka dosyasına düş. */
export function resolveCompanyLogo(
  presentation: CompanyPresentation | null | undefined,
): string | null {
  if (presentation?.logo) return presentation.logo
  if (isRememberedTrikomex(presentation ?? null)) return '/trikomex-logo.png?v=2'
  return null
}
