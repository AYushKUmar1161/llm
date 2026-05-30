import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import { Conversation, CreateConversationRequest, PaginatedResponse } from '@/lib/types'

export function useConversations(repositoryId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', repositoryId],
    queryFn: async () => {
      const response = await apiClient.get(`/repositories/${repositoryId}/conversations`)
      return response.data as PaginatedResponse<Conversation>
    },
    enabled: !!repositoryId,
    staleTime: 1000 * 30,
  })
}

export function useConversation(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['conversations', conversationId],
    queryFn: async () => {
      const response = await apiClient.get(`/conversations/${conversationId}`)
      return response.data as Conversation
    },
    enabled: !!conversationId,
  })
}

export function useCreateConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateConversationRequest) => {
      const response = await apiClient.post('/conversations', data)
      return response.data as Conversation
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.repositoryId] })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conversationId: string) => {
      await apiClient.delete(`/conversations/${conversationId}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

export function useAllConversations() {
  return useQuery({
    queryKey: ['conversations', 'all'],
    queryFn: async () => {
      const response = await apiClient.get('/chat')
      return response.data as Conversation[]
    },
    staleTime: 1000 * 30,
  })
}
