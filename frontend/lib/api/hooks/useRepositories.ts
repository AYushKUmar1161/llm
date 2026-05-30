import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import { ConnectRepositoryRequest, PaginatedResponse, Repository } from '@/lib/types'

export function useRepositories(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['repositories', { page, pageSize }],
    queryFn: async () => {
      const response = await apiClient.get('/repositories', { params: { page, pageSize } })
      return response.data as PaginatedResponse<Repository>
    },
    staleTime: 1000 * 30,
  })
}

export function useRepository(repoId: string | undefined) {
  return useQuery({
    queryKey: ['repositories', repoId],
    queryFn: async () => {
      const response = await apiClient.get(`/repositories/${repoId}`)
      return response.data as Repository
    },
    enabled: !!repoId,
    staleTime: 1000 * 60,
  })
}

export function useConnectRepository() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: ConnectRepositoryRequest) => {
      const response = await apiClient.post('/repositories', data)
      return response.data as Repository
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
    },
  })
}

export function useDeleteRepository() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (repoId: string) => {
      await apiClient.delete(`/repositories/${repoId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repositories'] })
    },
  })
}

export function useReindexRepository() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (repoId: string) => {
      const response = await apiClient.post(`/repositories/${repoId}/index`)
      return response.data as Repository
    },
    onSuccess: (_, repoId) => {
      queryClient.invalidateQueries({ queryKey: ['repositories', repoId] })
    },
  })
}

export function useIndexStatus(repoId: string | undefined) {
  return useQuery({
    queryKey: ['repositories', repoId, 'index-status'],
    queryFn: async () => {
      const response = await apiClient.get(`/repositories/${repoId}/index-status`)
      return response.data as { status: Repository['indexStatus']; progress: number }
    },
    enabled: !!repoId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (data?.status === 'indexing') return 2000
      return false
    },
  })
}
