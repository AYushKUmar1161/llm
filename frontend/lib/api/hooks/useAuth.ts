import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/stores/authStore'
import apiClient from '@/lib/api/client'
import { User } from '@/lib/types'

export interface ApiKey {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  created_at: string
  expires_at?: string
  last_used_at?: string
}

export interface ApiKeyCreated extends ApiKey {
  full_key: string
}

export function useCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/me')
      return response.data as User
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useLogin() {
  const login = useAuthStore((s) => s.login)
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      await login(email, password)
    },
  })
}

export function useLogout() {
  const logout = useAuthStore((s) => s.logout)
  return useMutation({
    mutationFn: async () => {
      logout()
    },
  })
}

export function useApiKeys() {
  return useQuery({
    queryKey: ['auth', 'api-keys'],
    queryFn: async () => {
      const response = await apiClient.get('/auth/api-keys')
      return response.data as ApiKey[]
    },
  })
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; expires_at?: string }) => {
      const response = await apiClient.post('/auth/api-keys', data)
      return response.data as ApiKeyCreated
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'api-keys'] })
    },
  })
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (keyId: string) => {
      await apiClient.delete(`/auth/api-keys/${keyId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth', 'api-keys'] })
    },
  })
}

