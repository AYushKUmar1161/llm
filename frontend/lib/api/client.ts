import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { ApiError } from '@/lib/types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401 → refresh token → retry
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return apiClient(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = getStoredRefreshToken()
        if (!refreshToken) throw new Error('No refresh token')

        const response = await axios.post(`${BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        })

        const accessToken = response.data.access_token
        const newRefreshToken = response.data.refresh_token

        if (accessToken) {
          setStoredTokenAndRefreshToken(accessToken, newRefreshToken)
          processQueue(null, accessToken)

          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return apiClient(originalRequest)
        } else {
          throw new Error('No access token returned')
        }
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null)
        clearStoredTokens()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(formatApiError(error))
  }
)

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (!authStorage) return null
    const parsed = JSON.parse(authStorage)
    return parsed?.state?.accessToken || null
  } catch {
    return null
  }
}

function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (!authStorage) return null
    const parsed = JSON.parse(authStorage)
    return parsed?.state?.refreshToken || null
  } catch {
    return null
  }
}

function setStoredToken(token: string): void {
  if (typeof window === 'undefined') return
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (!authStorage) return
    const parsed = JSON.parse(authStorage)
    parsed.state.accessToken = token
    localStorage.setItem('auth-storage', JSON.stringify(parsed))
  } catch {
    // ignore
  }
}

function setStoredTokenAndRefreshToken(token: string, refreshToken?: string): void {
  if (typeof window === 'undefined') return
  try {
    const authStorage = localStorage.getItem('auth-storage')
    if (!authStorage) return
    const parsed = JSON.parse(authStorage)
    parsed.state.accessToken = token
    if (refreshToken) {
      parsed.state.refreshToken = refreshToken
    }
    localStorage.setItem('auth-storage', JSON.stringify(parsed))
  } catch {
    // ignore
  }
}

function clearStoredTokens(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('auth-storage')
}

function formatApiError(error: AxiosError): ApiError {
  const data = error.response?.data as Record<string, unknown> | undefined
  return {
    message: (data?.message as string) || error.message || 'An unexpected error occurred',
    code: data?.code as string | undefined,
    statusCode: error.response?.status,
    details: data?.details as Record<string, unknown> | undefined,
  }
}

export default apiClient
