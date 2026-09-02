import { describe, expect, it } from 'vitest'
import { getCanonicalRedirectUrl } from './canonicalOrigin'

describe('canonical app origin', () => {
  it('redirects the Railway web address to the public application address', () => {
    expect(
      getCanonicalRedirectUrl(
        'https://vexor-web-production.up.railway.app/orders?tab=open#latest',
        true,
      ),
    ).toBe('https://erpvexor.com/orders?tab=open#latest')
  })

  it('does not redirect the canonical or local development address', () => {
    expect(getCanonicalRedirectUrl('https://erpvexor.com/', true)).toBeNull()
    expect(getCanonicalRedirectUrl('http://localhost:5173/', false)).toBeNull()
  })
})
