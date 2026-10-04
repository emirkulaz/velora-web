import { apiGet } from './api'

export interface AiCustomerOption { id: number; name: string }
export interface AiProductOption {
  id: number
  code: string
  name: string
  unit: 'METER' | 'PIECE' | 'KILOGRAM'
  salePrice: number | null
  isActive?: boolean
}

export async function loadAiEntryCatalog() {
  const [customers, products] = await Promise.all([
    apiGet<AiCustomerOption[]>('/customers'),
    apiGet<AiProductOption[]>('/products'),
  ])
  return { customers, products: products.filter((product) => product.isActive !== false), loadedAt: new Date().toISOString() }
}
