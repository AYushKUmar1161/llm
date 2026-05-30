import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import { Analytics } from '@/lib/types'

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const response = await apiClient.get('/analytics')
      return response.data as Analytics
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    placeholderData: {
      totalRepositories: 0,
      totalConversations: 0,
      totalMessages: 0,
      totalTokensUsed: 0,
      totalAgentRuns: 0,
      conversationsToday: 0,
      tokensToday: 0,
      agentRunsToday: 0,
      tokenUsageOverTime: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 86400000).toISOString().split('T')[0],
        tokens: Math.floor(Math.random() * 50000) + 10000,
        cost: Math.random() * 5 + 0.5,
      })),
      agentTypeBreakdown: [
        { agentType: 'understand' as const, count: 42, tokensUsed: 180000 },
        { agentType: 'architect' as const, count: 18, tokensUsed: 95000 },
        { agentType: 'feature' as const, count: 31, tokensUsed: 220000 },
        { agentType: 'review' as const, count: 25, tokensUsed: 140000 },
        { agentType: 'tests' as const, count: 15, tokensUsed: 88000 },
        { agentType: 'security' as const, count: 12, tokensUsed: 72000 },
        { agentType: 'docs' as const, count: 9, tokensUsed: 55000 },
        { agentType: 'memory' as const, count: 6, tokensUsed: 30000 },
      ],
      recentActivity: [],
    },
  })
}
