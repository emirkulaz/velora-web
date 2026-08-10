const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

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
    throw new ApiError(message, response.status)
  }

  return response.json() as Promise<T>
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path)
}
