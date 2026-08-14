import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  SESSION_EXPIRED_EVENT,
  apiGet,
  apiPublicPost,
} from './api'

describe('central API client', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('adds the current bearer token to authenticated requests', async () => {
    localStorage.setItem('velora.accessToken', 'test-token')
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiGet<{ ok: true }>('/health')).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
  })

  it('emits session expiry on authenticated 401 responses', async () => {
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Yetkisiz' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(apiGet('/users/me')).rejects.toMatchObject({ status: 401 })
    expect(expired).toHaveBeenCalledTimes(1)
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('does not attach a token or expire a session for public login errors', async () => {
    localStorage.setItem('velora.accessToken', 'old-token')
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    const fetchMock = vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(null, { status: 401 }),
    )

    await expect(
      apiPublicPost('/auth/login', { email: 'user@example.com', password: 'x' }),
    ).rejects.toBeInstanceOf(ApiError)
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request?.headers).not.toHaveProperty('Authorization')
    expect(expired).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('redacts secret-looking backend messages', async () => {
    vi.spyOn(window, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'postgresql://user:password@private/db' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(apiGet('/broken')).rejects.toMatchObject({
      status: 500,
      message: 'Sunucu işlemi tamamlayamadı. Lütfen daha sonra tekrar deneyin.',
    })
  })
})
