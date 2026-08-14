import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../i18n/I18nProvider'

const { apiDelete, apiGet } = vi.hoisted(() => ({
  apiDelete: vi.fn(),
  apiGet: vi.fn(),
}))

vi.mock('../data/api', () => ({
  ApiError: class ApiError extends Error {},
  apiDelete,
  apiGet,
  apiPatch: vi.fn(),
  apiPost: vi.fn(),
}))

import { BomRecipesTab } from './BomRecipesTab'

describe('BomRecipesTab localization and safety', () => {
  beforeEach(() => {
    localStorage.clear()
    apiDelete.mockReset().mockResolvedValue(undefined)
    apiGet.mockReset().mockImplementation((path: string) => {
      if (path === '/products') return Promise.resolve([])
      return Promise.resolve([
        {
          id: 5,
          productId: 2,
          productCode: 'COL-01',
          productName: 'Col textile',
          name: 'Recette principale',
          version: 1,
          isActive: true,
          items: [
            {
              materialProductId: 8,
              materialName: 'Fil polyester',
              quantityPerUnit: 15.5,
              unit: 'PIECE',
              wastePercent: 3,
            },
          ],
        },
      ])
    })
  })

  it('translates units and requires confirmation before deleting a recipe', async () => {
    const user = userEvent.setup()
    localStorage.setItem('velora.uiLanguage', 'fr')

    render(
      <I18nProvider>
        <BomRecipesTab
          canWrite
          company={{ companyId: 1, name: 'TRIKOMEX Textile', currency: 'DZD', logo: null, sectorPack: 'TEXTILE' }}
        />
      </I18nProvider>,
    )

    expect(await screen.findByText('Recette principale')).toBeInTheDocument()
    expect(screen.getByText(/15,5 Pièce/)).toBeInTheDocument()
    expect(screen.queryByText('PIECE')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(apiDelete).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: 'Supprimer la recette' })).toBeInTheDocument()
  })
})
