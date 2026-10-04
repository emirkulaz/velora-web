const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')
export const SESSION_EXPIRED_EVENT = 'velora:session-expired'
const REQUEST_TIMEOUT_MS = 30_000
const TRANSIENT_GET_STATUSES = new Set([408, 502, 503, 504])

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function readAccessToken(): string | null {
  return (
    localStorage.getItem('velora.accessToken') ??
    sessionStorage.getItem('velora.accessToken')
  )
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Oturumunuz sona erdi. Lütfen yeniden giriş yapın.'
  if (status === 403) return 'Bu işlem için yetkiniz yok.'
  if (status === 429) return 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.'
  if (status >= 500) return 'Sunucu işlemi tamamlayamadı. Lütfen daha sonra tekrar deneyin.'
  if (status === 404) return 'Kayıt bulunamadı. Listeyi yenileyip tekrar deneyin.'
  if (status === 409) return 'Bu kayıt değişmiş veya zaten mevcut. Bilgileri yenileyip kontrol edin.'
  return 'İstek tamamlanamadı.'
}

async function parseError(response: Response): Promise<ApiError> {
  let message = fallbackMessage(response.status)
  try {
    const body = (await response.json()) as { message?: string | string[] }
    if (typeof body.message === 'string' && body.message.trim()) {
      message = body.message
    } else if (Array.isArray(body.message) && body.message.length > 0) {
      message = body.message.join(' ')
    }
  } catch {
    // Keep the status-specific safe fallback.
  }
  if (/api[_-]?key|sk-[a-z0-9]|bearer\s+|postgres(?:ql)?:\/\/|prisma|SQLSTATE|\bconstraint\b|\bat \S+\.(?:ts|js):\d+/i.test(message) || response.status >= 500) {
    message = fallbackMessage(response.status)
  }
  if (/must be|should not|property \S+ should|is not a valid enum/i.test(message)) {
    message = /amount|price|quantity/i.test(message)
      ? 'Tutar ve miktar alanlarını kontrol edin. Geçerli bir sayı girin.'
      : /date|transactionAt/i.test(message)
        ? 'Tarihi kontrol edin ve geçerli bir tarih seçin.'
        : 'Gerekli bilgileri kontrol edip eksik alanları doldurun.'
  }
  return new ApiError(message, response.status)
}

function requestMethod(init?: RequestInit): string {
  return (init?.method ?? 'GET').toUpperCase()
}

function waitBeforeRetry(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 200))
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  let timedOut = false
  const forwardAbort = () => controller.abort(init?.signal?.reason)
  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, /\/ai\/(?:documents|confirm-write)(?:\/|$)/.test(url) ? 90_000 : REQUEST_TIMEOUT_MS)

  if (init?.signal?.aborted) {
    forwardAbort()
  } else {
    init?.signal?.addEventListener('abort', forwardAbort, { once: true })
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch {
    if (init?.signal?.aborted) {
      throw new ApiError('İstek iptal edildi.', 0)
    }
    if (timedOut) {
      throw new ApiError('Sunucu zamanında yanıt vermedi. Lütfen tekrar deneyin.', 0)
    }
    throw new ApiError('Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.', 0)
  } finally {
    window.clearTimeout(timeoutId)
    init?.signal?.removeEventListener('abort', forwardAbort)
  }
}

async function fetchWithSafeRetry(path: string, init?: RequestInit): Promise<Response> {
  const canRetry = requestMethod(init) === 'GET'
  const attempts = canRetry ? 2 : 1
  let lastError: ApiError | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, init)
      if (
        canRetry &&
        attempt + 1 < attempts &&
        TRANSIENT_GET_STATUSES.has(response.status)
      ) {
        await waitBeforeRetry()
        continue
      }
      return response
    } catch (error) {
      lastError = error instanceof ApiError
        ? error
        : new ApiError('Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.', 0)
      if (!canRetry || attempt + 1 >= attempts || init?.signal?.aborted) {
        throw lastError
      }
      await waitBeforeRetry()
    }
  }

  throw lastError ?? new ApiError('İstek tamamlanamadı.', 0)
}

async function request<T>(
  path: string,
  init: RequestInit | undefined,
  accessToken: string | null,
  emitSessionExpired: boolean,
): Promise<T> {
  const response = await fetchWithSafeRetry(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (!response.ok) {
    if (response.status === 401 && emitSessionExpired) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw await parseError(response)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken =
    readAccessToken()
  return request<T>(path, init, accessToken, true)
}

export function apiPublicPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    null,
    false,
  )
}

export function apiGetWithToken<T>(path: string, accessToken: string): Promise<T> {
  return request<T>(path, undefined, accessToken, false)
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path)
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** Multipart upload — Content-Type'ı tarayıcı boundary ile set eder. */
export function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  return apiRequest<T>(path, {
    method: 'POST',
    body: formData,
  })
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: 'DELETE' })
}

export async function apiDownload(path: string): Promise<Blob> {
  const accessToken = readAccessToken()
  const response = await fetchWithSafeRetry(path, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  })
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw await parseError(response)
  }
  return response.blob()
}
