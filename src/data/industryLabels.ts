import { isTextileCompany, type CompanyPresentation } from './companyBranding'

/** Genel VEXOR: Hammadde / Malzeme. Textile profili: İplik / Hammadde. */
export function materialLabel(company?: CompanyPresentation | null): string {
  return isTextileCompany(company) ? 'İplik / Hammadde' : 'Hammadde / Malzeme'
}

export function materialShortLabel(company?: CompanyPresentation | null): string {
  return isTextileCompany(company) ? 'İplik' : 'Hammadde'
}
