const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

interface FetchOptions extends RequestInit {
  data?: any
  params?: Record<string, string | number | boolean | undefined | null>
}

export class ApiError extends Error {
  status: number
  data: any
  constructor(status: number, message: string, data?: any) {
    super(message)
    this.status = status
    this.data = data
  }
}

let refreshPromise: Promise<boolean> | null = null

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
  const { data, params, headers: customHeaders, ...customConfig } = options

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

  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    ...customConfig,
    headers: {
      ...customHeaders,
    },
    credentials: 'include', // Ensure cookies are sent
  }

  if (data) {
    if (data instanceof FormData) {
      config.body = data
      // fetch handles multipart boundary automatically when passing FormData
    } else if (data instanceof Blob || data instanceof ArrayBuffer || (typeof Buffer !== 'undefined' && Buffer.isBuffer(data))) {
      config.body = data
    } else {
      config.body = JSON.stringify(data)
      config.headers = {
        ...config.headers,
        'Content-Type': 'application/json',
      }
    }
  }

  try {
    const response = await fetch(url, config)

    if (response.status === 401) {
      if (endpoint.startsWith('/auth/')) {
        return handleResponse(response)
      }

      const refreshed = await performRefresh()
      if (refreshed) {
        const retryResponse = await fetch(url, config)
        return handleResponse(retryResponse)
      } else {
        throw new ApiError(401, 'Session expired')
      }
    }

    return handleResponse(response)
  } catch (error) {
    if (error instanceof ApiError || (error && typeof (error as any).status === 'number')) {
      throw error
    }
    throw new ApiError(0, error instanceof Error ? error.message : 'Network error')
  }
}

async function handleResponse(response: Response) {
  const contentType = response.headers.get('content-type')
  let data
  if (contentType && contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (response.ok) {
    return data
  }

  // Handle specific status codes
  let errorMessage = data?.message || data?.error || 'An error occurred'
  
  if (response.status === 403) {
    errorMessage = 'You do not have permission to perform this action'
  } else if (response.status === 404) {
    errorMessage = 'Resource not found'
  } else if (response.status >= 500) {
    errorMessage = 'A server error occurred. Please try again later.'
  }

  throw new ApiError(
    response.status,
    errorMessage,
    data
  )
}

export const client = {
  get: (endpoint: string, options?: FetchOptions) => fetchWithInterceptor(endpoint, { ...options, method: 'GET' }),
  post: (endpoint: string, data?: any, options?: FetchOptions) => fetchWithInterceptor(endpoint, { ...options, method: 'POST', data }),
  patch: (endpoint: string, data?: any, options?: FetchOptions) => fetchWithInterceptor(endpoint, { ...options, method: 'PATCH', data }),
  delete: (endpoint: string, options?: FetchOptions) => fetchWithInterceptor(endpoint, { ...options, method: 'DELETE' }),
}
