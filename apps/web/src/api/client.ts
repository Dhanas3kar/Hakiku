const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const DEFAULT_TIMEOUT_MS = 30000

type ErrorCode = 'NETWORK' | 'TIMEOUT' | 'OFFLINE' | 'AUTH' | 'HTTP' | 'UNKNOWN'

interface FetchOptions extends RequestInit {
  data?: any
  params?: Record<string, string | number | boolean | undefined | null>
  timeoutMs?: number
  skipAuthRefresh?: boolean
}

export class ApiError extends Error {
  status: number
  data: any
  code: ErrorCode
  cause?: unknown

  constructor(status: number, message: string, data?: any, code: ErrorCode = 'HTTP', cause?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
    this.code = code
    this.cause = cause
  }
}

let csrfToken: string | null = null

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  try {
    const res = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      csrfToken = data.csrfToken
      return csrfToken
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('Failed to fetch CSRF token', e)
    }
  }
  return null
}

let refreshPromise: Promise<boolean> | null = null
let authFailureEventLocked = false

function emitAuthExpired(reason: string = 'session-expired') {
  if (typeof window === 'undefined') return

  if (authFailureEventLocked) return
  authFailureEventLocked = true

  window.dispatchEvent(new CustomEvent('auth:expired', { detail: { reason } }))

  window.setTimeout(() => {
    authFailureEventLocked = false
  }, 250)
}

async function performRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      return refreshResponse.ok
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function fetchWithInterceptor(endpoint: string, options: FetchOptions = {}): Promise<any> {
  const { data, params, headers: customHeaders, timeoutMs, skipAuthRefresh, signal: callerSignal, ...customConfig } = options

  let url = `${API_BASE_URL}${endpoint}`
  if (params) {
    const queryParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value))
      }
    })
    const queryString = queryParams.toString()
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString
    }
  }

  const requestTimeoutMs = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS
  const controller = typeof AbortController !== 'undefined' && !callerSignal ? new AbortController() : null
  const requestSignal = callerSignal ?? controller?.signal

  if (controller && requestTimeoutMs > 0) {
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs)
    if (timeoutId) {
      // allow Node/modern browser timer cleanup after fetch completes
      ;(controller as any).__timeoutId = timeoutId
    }
  }

  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...customHeaders,
    },
    credentials: 'include',
    signal: requestSignal,
  }

  if (data) {
    if (data instanceof FormData) {
      config.body = data
    } else if (data instanceof Blob || data instanceof ArrayBuffer || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))) {
      config.body = data as any
    } else {
      config.body = JSON.stringify(data)
      config.headers = {
        ...config.headers,
        'Content-Type': 'application/json',
      }
    }
  }

  const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(config.method as string)

  if (isMutatingMethod) {
    const token = await getCsrfToken()
    if (token) {
      config.headers = {
        ...config.headers,
        'csrf-token': token,
      }
    }
  }

  try {
    const response = await fetch(url, config)

    if (response.status === 401) {
      if (endpoint.startsWith('/auth/') || skipAuthRefresh) {
        return handleResponse(response)
      }

      const refreshed = await performRefresh()
      if (refreshed) {
        const retryResponse = await fetch(url, { ...config, signal: requestSignal })
        return handleResponse(retryResponse)
      }

      emitAuthExpired('session-expired')
      throw new ApiError(401, 'Session expired', null, 'AUTH')
    }

    return handleResponse(response)
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 403) {
        csrfToken = null // Clear token on 403 so it gets refetched
      }
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out. Please try again.', null, 'TIMEOUT', error)
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ApiError(0, 'You appear to be offline. Please check your connection and try again.', null, 'OFFLINE', error)
    }

    if (error instanceof TypeError) {
      throw new ApiError(0, 'Unable to connect to the server. Please check your internet connection and try again.', null, 'NETWORK', error)
    }

    throw new ApiError(0, 'An unexpected error occurred. Please try again.', null, 'UNKNOWN', error)
  } finally {
    if (controller && (controller as any).__timeoutId) {
      clearTimeout((controller as any).__timeoutId)
    }
  }
}

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type')
  let data
  try {
    if (contentType && contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('Malformed API response payload', err)
    }
    data = null
  }

  if (response.ok) {
    return data
  }

  let errorMessage = data?.message || data?.error || 'An error occurred'

  if (Array.isArray(data?.message)) {
    errorMessage = data.message.join(', ')
  }

  if (response.status === 400 || response.status === 422) {
    // Validation errors preserved as-is.
  } else if (response.status === 401) {
    errorMessage = 'Authentication required'
  } else if (response.status === 403) {
    errorMessage = 'You do not have permission to perform this action'
  } else if (response.status === 404) {
    errorMessage = 'Resource not found'
  } else if (response.status === 409) {
    errorMessage = data?.message || 'A conflict occurred with the current state'
  } else if (response.status === 429) {
    errorMessage = 'Too many requests. Please try again later.'
  } else if (response.status >= 500) {
    errorMessage = 'A server error occurred. Please try again later.'
    if (data?.stack && import.meta.env.PROD) {
      delete data.stack
    }
  }

  throw new ApiError(response.status, errorMessage, data, response.status === 401 ? 'AUTH' : 'HTTP')
}

export const client = {
  get: <T = any>(endpoint: string, options?: FetchOptions): Promise<T> => fetchWithInterceptor(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> => fetchWithInterceptor(endpoint, { ...options, method: 'POST', data }),
  patch: <T = any>(endpoint: string, data?: any, options?: FetchOptions): Promise<T> => fetchWithInterceptor(endpoint, { ...options, method: 'PATCH', data }),
  delete: <T = any>(endpoint: string, options?: FetchOptions): Promise<T> => fetchWithInterceptor(endpoint, { ...options, method: 'DELETE' }),
}
