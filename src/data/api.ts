const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
export const SESSION_EXPIRED_EVENT = 'velora:session-expired'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken =
    localStorage.getItem('velora.accessToken') ??
    sessionStorage.getItem('velora.accessToken')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })

  if (!response.ok) {
    let message = 'Veriler alınamadı.'
    try {
      const body = (await response.json()) as { message?: string | string[] }
      if (typeof body.message === 'string' && body.message.trim()) {
        message = body.message
      } else if (Array.isArray(body.message) && body.message.length > 0) {
        message = body.message.join(' ')
      }
    } catch {
      // keep default message
    }
    // Never surface secret-looking fragments from error payloads.
    if (/api[_-]?key|sk-[a-z0-9]/i.test(message)) {
      message = 'İstek tamamlanamadı. Lütfen daha sonra tekrar deneyin.'
    }
    if (response.status === 401) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
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
