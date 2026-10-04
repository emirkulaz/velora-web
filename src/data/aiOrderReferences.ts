import { apiGet } from './api'
export interface AiOrderReference {
  id: number
  orderNumber: string
  customerName: string | null
  productName: string | null
}
export async function loadAiOrderReferences() {
  const orders = await apiGet<AiOrderReference[]>('/orders')
  // Keep only identifiers needed for choosing the subject of a question.
  return { orders: orders.map(({ id, orderNumber, customerName, productName }) => ({ id, orderNumber, customerName, productName })), loadedAt: new Date().toISOString() }
}
