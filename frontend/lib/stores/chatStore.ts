import { create } from 'zustand'
import { Conversation, Message, AgentType } from '@/lib/types'
import apiClient from '@/lib/api/client'

interface ChatStore {
  conversations: Conversation[]
  currentConversation: Conversation | null
  messages: Message[]
  isStreaming: boolean
  activeAgent: AgentType
  streamingContent: string
  error: string | null

  setActiveAgent: (agent: AgentType) => void
  setCurrentConversation: (conv: Conversation | null) => void
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  updateStreamingContent: (content: string) => void
  setIsStreaming: (streaming: boolean) => void
  appendToLastMessage: (token: string) => void
  finalizeStreamedMessage: (message: Message) => void
  createConversation: (repositoryId: string, title?: string, agentType?: AgentType) => Promise<Conversation>
  loadConversation: (conversationId: string) => Promise<void>
  loadConversations: (repositoryId: string) => Promise<void>
  sendMessage: (conversationId: string, content: string) => Promise<void>
  clearError: () => void
  resetChat: () => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isStreaming: false,
  activeAgent: 'understand',
  streamingContent: '',
  error: null,

  setActiveAgent: (agent) => set({ activeAgent: agent }),

  setCurrentConversation: (conv) => set({ currentConversation: conv }),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  updateStreamingContent: (content) => set({ streamingContent: content }),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  appendToLastMessage: (token) => {
    set((state) => {
      const messages = [...state.messages]
      if (messages.length === 0) return state
      const last = { ...messages[messages.length - 1] }
      last.content += token
      messages[messages.length - 1] = last
      return { messages }
    })
  },

  finalizeStreamedMessage: (message) => {
    set((state) => {
      const messages = state.messages.filter((m) => !m.isStreaming)
      return { messages: [...messages, { ...message, isStreaming: false }], isStreaming: false, streamingContent: '' }
    })
  },

  createConversation: async (repositoryId, title, agentType) => {
    const { activeAgent } = get()
    const response = await apiClient.post('/conversations', {
      repo_id: repositoryId,
      repositoryId,
      title: title || `New ${agentType || activeAgent} conversation`,
      agent_type: agentType || activeAgent,
      agentType: agentType || activeAgent,
    })
    const conversation: Conversation = response.data
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversation: conversation,
      messages: [],
    }))
    return conversation
  },

  loadConversation: async (conversationId) => {
    try {
      const [convResp, msgsResp] = await Promise.all([
        apiClient.get(`/conversations/${conversationId}`),
        apiClient.get(`/conversations/${conversationId}/messages`),
      ])
      set({
        currentConversation: convResp.data,
        messages: msgsResp.data,
      })
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message || 'Failed to load conversation' })
    }
  },

  loadConversations: async (repositoryId) => {
    try {
      const response = await apiClient.get(`/repositories/${repositoryId}/conversations`)
      set({ conversations: response.data })
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message || 'Failed to load conversations' })
    }
  },

  sendMessage: async (conversationId, content) => {
    const { activeAgent, addMessage } = get()
    const tempUserMessage: Message = {
      id: `temp-${Date.now()}`,
      conversationId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    addMessage(tempUserMessage)

    const tempAssistantMessage: Message = {
      id: `streaming-${Date.now()}`,
      conversationId,
      role: 'assistant',
      content: '',
      agentType: activeAgent,
      isStreaming: true,
      createdAt: new Date().toISOString(),
    }
    addMessage(tempAssistantMessage)
    set({ isStreaming: true })

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/conversations/${conversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            role: 'user',
            content,
            agent_type: activeAgent,
            agentType: activeAgent,
          }),
        }
      )

      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.replace('data: ', '').trim()
          if (data === '[DONE]') break
          try {
            const chunk = JSON.parse(data)
            if (chunk.type === 'token' && chunk.content) {
              get().appendToLastMessage(chunk.content)
            } else if (chunk.type === 'done' && chunk.message) {
              get().finalizeStreamedMessage(chunk.message)
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      set({ error: (err as { message?: string })?.message || 'Failed to send message', isStreaming: false })
    } finally {
      set({ isStreaming: false })
    }
  },

  clearError: () => set({ error: null }),
  resetChat: () => set({ currentConversation: null, messages: [], isStreaming: false, streamingContent: '' }),
}))

function getToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const s = localStorage.getItem('auth-storage')
    if (!s) return ''
    return JSON.parse(s)?.state?.accessToken || ''
  } catch {
    return ''
  }
}
