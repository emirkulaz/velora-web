import { beforeEach, expect, it, vi } from 'vitest'
import { loadAiEntryCatalog } from './aiEntryCatalog'
import { apiGet } from './api'
vi.mock('./api', () => ({ apiGet: vi.fn() }))
beforeEach(() => vi.mocked(apiGet).mockReset())
it('loads catalog through authenticated APIs and excludes inactive products', async () => {
  vi.mocked(apiGet).mockResolvedValueOnce([{ id: 1, name: 'Client' }]).mockResolvedValueOnce([
    { id: 1, isActive: true }, { id: 2, isActive: false }, { id: 3 },
  ])
  const catalog = await loadAiEntryCatalog()
  expect(apiGet).toHaveBeenCalledWith('/customers')
  expect(apiGet).toHaveBeenCalledWith('/products')
  expect(catalog.products.map((item) => item.id)).toEqual([1, 3])
  expect(Number.isNaN(Date.parse(catalog.loadedAt))).toBe(false)
})
it('rejects incomplete catalog loads', async () => {
  vi.mocked(apiGet).mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('Forbidden'))
  await expect(loadAiEntryCatalog()).rejects.toThrow('Forbidden')
})
