import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import { AgentRun } from '@/lib/types'

export function useAgentRuns(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['agent-runs', conversationId],
    queryFn: async () => {
      const response = await apiClient.get(`/conversations/${conversationId}/agent-runs`)
      return response.data as AgentRun[]
    },
    enabled: !!conversationId,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      const hasRunning = data.some((r: AgentRun) => r.status === 'running' || r.status === 'pending')
      return hasRunning ? 1500 : false
    },
  })
}

export function useRecentAgentRuns(repositoryId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['agent-runs', 'recent', repositoryId],
    queryFn: async () => {
      const response = await apiClient.get(`/repositories/${repositoryId}/agent-runs`, {
        params: { limit },
      })
      return response.data as AgentRun[]
    },
    enabled: !!repositoryId,
    staleTime: 1000 * 30,
  })
}
