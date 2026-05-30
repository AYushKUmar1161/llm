import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/lib/types'
import apiClient from '@/lib/api/client'

interface AuthStore {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  loginWithGithub: () => void
  logout: () => void
  refreshAccessToken: () => Promise<void>
  setUser: (user: User) => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await apiClient.post('/auth/login', { email, password })
          const accessToken = response.data.access_token
          const refreshToken = response.data.refresh_token

          if (!accessToken || !refreshToken) {
            throw new Error('Failed to retrieve authentication tokens')
          }

          set({
            accessToken,
            refreshToken,
            isAuthenticated: true,
            error: null,
          })

          if (typeof document !== 'undefined') {
            document.cookie = `cf_access_token=${accessToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax; Secure`
          }

          // Fetch the user details using the newly saved access token
          const userResponse = await apiClient.get('/auth/me')
          set({
            user: userResponse.data,
            isLoading: false,
          })
        } catch (err: unknown) {
          const message = (err as { message?: string })?.message || 'Login failed'
          set({ isLoading: false, error: message, isAuthenticated: false, user: null, accessToken: null, refreshToken: null })
          throw err
        }
      },

      loginWithGithub: () => {
        const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID
        const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`
        const scope = 'read:user user:email repo'
        const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scope)}`
        window.location.href = githubAuthUrl
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
        })
        if (typeof document !== 'undefined') {
          document.cookie = 'cf_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;'
        }
        // Optionally call server logout
        apiClient.post('/auth/logout').catch(() => {})
        window.location.href = '/login'
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          set({ isAuthenticated: false, user: null, accessToken: null })
          if (typeof document !== 'undefined') {
            document.cookie = 'cf_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;'
          }
          return
        }
        try {
          const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken })
          const newToken = response.data.access_token
          const newRefreshToken = response.data.refresh_token || refreshToken
          set({ accessToken: newToken, refreshToken: newRefreshToken })
          if (typeof document !== 'undefined') {
            document.cookie = `cf_access_token=${newToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax; Secure`
          }
        } catch {
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
          if (typeof document !== 'undefined') {
            document.cookie = 'cf_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT;'
          }
        }
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
