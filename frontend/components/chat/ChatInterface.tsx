'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Send, Bot, Sparkles, Terminal, FileCode, CheckCircle,
  Paperclip, ArrowDown, RefreshCw, Cpu
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useChatStore } from '@/lib/stores/chatStore'
import { useRepoStore } from '@/lib/stores/repoStore'
import { AGENT_CONFIG, Message, AgentType } from '@/lib/types'
import MessageBubble from './MessageBubble'
import { cn } from '@/lib/utils'

interface ChatInterfaceProps {
  repoId: string
}

export default function ChatInterface({ repoId }: ChatInterfaceProps) {
  const {
    messages, currentConversation, isStreaming, activeAgent,
    setActiveAgent, createConversation, loadConversations,
    conversations, appendToLastMessage, finalizeStreamedMessage,
    addMessage, setIsStreaming
  } = useChatStore()

  const { currentRepo } = useRepoStore()
  const [input, setInput] = useState('')
  const [ws, setWs] = useState<WebSocket | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  const [pastedCode, setPastedCode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Establish WebSocket connection when currentConversation changes
  useEffect(() => {
    if (!currentConversation) return

    // Close existing socket
    if (ws) {
      ws.close()
    }

    setConnecting(true)
    setConnectionStatus('connecting')
    let reconnectTimeout: NodeJS.Timeout
    let activeSocket: WebSocket | null = null
    let attempt = 0

    const connect = () => {
      const wsBase = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/api/v1'
      const wsUrl = `${wsBase.endsWith('/api/v1') ? wsBase : `${wsBase}/api/v1`}/chat/ws/chat/${currentConversation.id}`
      const token = getToken()
      
      logger(`Connecting to WS: ${wsUrl}`)
      const socket = new WebSocket(`${wsUrl}?token=${token}`)
      activeSocket = socket

      socket.onopen = () => {
        logger('WebSocket connected successfully')
        setConnecting(false)
        setConnectionStatus('connected')
        attempt = 0
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'start') {
            const tempMsg: Message = {
              id: `streaming-${Date.now()}`,
              conversationId: currentConversation.id,
              role: 'assistant',
              content: '',
              agentType: activeAgent,
              isStreaming: true,
              createdAt: new Date().toISOString(),
            }
            addMessage(tempMsg)
            setIsStreaming(true)
          } else if (data.type === 'chunk' && data.content) {
            appendToLastMessage(data.content)
          } else if (data.type === 'done') {
            const finalMsg: Message = {
              id: data.message_id || `msg-${Date.now()}`,
              conversationId: currentConversation.id,
              role: 'assistant',
              content: '',
              agentType: activeAgent,
              sources: data.sources || [],
              createdAt: new Date().toISOString(),
            }
            finalizeStreamedMessage(finalMsg)
          }
        } catch (err) {
          console.error('Failed to parse socket message:', err)
        }
      }

      socket.onerror = (err) => {
        console.error('WebSocket error occurred:', err)
      }

      socket.onclose = () => {
        logger('WebSocket connection closed')
        setConnectionStatus('disconnected')
        setConnecting(false)

        // Prevent infinite retries if component unmounts or conversation changes
        if (activeSocket === socket) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
          logger(`Reconnecting in ${delay}ms (attempt ${attempt + 1})...`)
          reconnectTimeout = setTimeout(() => {
            attempt++
            setConnecting(true)
            setConnectionStatus('connecting')
            connect()
          }, delay)
        }
      }

      setWs(socket)
    }

    connect()

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (activeSocket) {
        activeSocket.onclose = null // disable reconnection logic on cleanup
        activeSocket.close()
      }
    }
  }, [currentConversation])

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isStreaming) return

    let conv = currentConversation
    // 1. Create a conversation if one doesn't exist yet
    if (!conv) {
      try {
        conv = await createConversation(repoId, `Chat with ${currentRepo?.name || 'repo'}`, activeAgent)
      } catch (err) {
        console.error('Failed to create conversation:', err)
        return
      }
    }

    if (!conv) return

    const messageText = input.trim()
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Add User Message local state
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      conversationId: conv.id,
      role: 'user',
      content: messageText,
      agentType: activeAgent,
      createdAt: new Date().toISOString(),
    }
    addMessage(userMsg)

    // 2. Send over WebSocket if connected
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        content: messageText,
        agent_type: activeAgent,
      }))
    } else {
      // Fallback REST POST
      try {
        setIsStreaming(true)
        const tempAssistant: Message = {
          id: `temp-assistant-${Date.now()}`,
          conversationId: conv.id,
          role: 'assistant',
          content: 'Thinking...',
          agentType: activeAgent,
          createdAt: new Date().toISOString(),
        }
        addMessage(tempAssistant)

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/conversations/${conv.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            role: 'user',
            content: messageText,
            agent_type: activeAgent,
            agentType: activeAgent,
          }),
        })
        const data = await res.json()
        finalizeStreamedMessage(data)
      } catch (err) {
        console.error('REST Fallback send failed:', err)
        setIsStreaming(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleAttachCode = () => {
    const code = prompt('Paste your code snippet here to share with the active agent:')
    if (code) {
      setInput((prev) => `${prev}\n\`\`\`\n${code}\n\`\`\``)
      setPastedCode(true)
      setTimeout(() => setPastedCode(false), 2000)
    }
  }

  function getToken(): string {
    if (typeof window === 'undefined') return ''
    try {
      const s = localStorage.getItem('auth-storage')
      return JSON.parse(s || '')?.state?.accessToken || ''
    } catch {
      return ''
    }
  }

  function logger(msg: string) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[ChatInterface] ${msg}`)
    }
  }

  const activeAgentConfig = AGENT_CONFIG[activeAgent as keyof typeof AGENT_CONFIG] || {
    label: 'Orchestrator',
    emoji: '🤖',
  }

  return (
    <div className="flex flex-col h-full bg-surface-950/20 relative">
      {/* Agent Selector Toolbar */}
      <div className="px-4 py-2 bg-surface-900/40 border-b border-white/[0.04] flex items-center justify-between gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
        <div className="flex items-center gap-1">
          {Object.entries(AGENT_CONFIG).map(([key, config]) => {
            const isSelected = activeAgent === key
            return (
              <button
                key={key}
                onClick={() => setActiveAgent(key as AgentType)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border border-transparent',
                  isSelected
                    ? 'bg-brand-500/10 text-brand-300 border-brand-500/25 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                )}
              >
                <span>{config.emoji}</span>
                <span>{config.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <Badge variant="outline" className="text-[10px] gap-1.5 border-emerald-500/30 text-emerald-400 bg-emerald-500/5 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> connected
            </Badge>
          )}
          {connectionStatus === 'connecting' && (
            <Badge variant="outline" className="text-[10px] gap-1.5 border-brand-500/30 text-brand-400 bg-brand-500/5 animate-pulse select-none">
              <Cpu className="w-3 h-3 animate-spin text-brand-400" /> connecting...
            </Badge>
          )}
          {connectionStatus === 'disconnected' && currentConversation && (
            <Badge variant="outline" className="text-[10px] gap-1.5 border-red-500/30 text-red-400 bg-red-500/5 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> offline
            </Badge>
          )}
        </div>
      </div>

      {/* Message History list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-2xl shadow-glow">
              {activeAgentConfig.emoji}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Ask {activeAgentConfig.label} Anything</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter a question or custom instruction about the files in <span className="font-semibold text-brand-400">{currentRepo?.name}</span>.
              </p>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => <MessageBubble key={msg.id || i} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel Form */}
      <div className="p-4 border-t border-white/[0.04] bg-surface-900/10 flex-shrink-0">
        <form onSubmit={handleSend} className="relative glass border border-white/[0.08] rounded-2xl overflow-hidden focus-within:border-brand-500/40 focus-within:ring-1 focus-within:ring-brand-500/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${activeAgentConfig.label}... (Press Enter to send, Shift+Enter for newline)`}
            className="w-full pl-4 pr-16 py-3.5 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 resize-none max-h-36 focus:outline-none min-h-[48px] scrollbar-thin"
          />

          <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAttachCode}
              title="Attach Code Snippet"
              className={cn(
                'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all',
                pastedCode && 'text-emerald-400 hover:text-emerald-400 bg-emerald-500/10'
              )}
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="h-7 w-7 rounded-lg bg-brand-500 hover:bg-brand-600 shadow-glow disabled:opacity-40 disabled:hover:bg-brand-500"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
