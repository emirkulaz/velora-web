const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/+$/, '')
export const SESSION_EXPIRED_EVENT = 'velora:session-expired'

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
  if (/api[_-]?key|sk-[a-z0-9]|bearer\s+|postgres(?:ql)?:\/\//i.test(message)) {
    message = fallbackMessage(response.status)
  }
  return new ApiError(message, response.status)
}

async function request<T>(
  path: string,
  init: RequestInit | undefined,
  accessToken: string | null,
  emitSessionExpired: boolean,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    })
  } catch {
    throw new ApiError('Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.', 0)
  }

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
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    })
  } catch {
    throw new ApiError('Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.', 0)
  }
  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw await parseError(response)
  }
  return response.blob()
}
