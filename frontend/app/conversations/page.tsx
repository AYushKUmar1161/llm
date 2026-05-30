'use client'

import { motion } from 'framer-motion'
import { MessageSquare, Search, ArrowRight, Bot, Trash2, Calendar, Database, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'react-hot-toast'
import { useAllConversations, useDeleteConversation } from '@/lib/api/hooks/useConversations'
import { useChatStore } from '@/lib/stores/chatStore'
import { formatRelativeTime } from '@/lib/utils'
import { AGENT_CONFIG, Conversation } from '@/lib/types'

export default function ConversationsPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const { data: conversations, isLoading, refetch } = useAllConversations()
  const deleteMutation = useDeleteConversation()
  const { setCurrentConversation, setActiveAgent } = useChatStore()

  const list = conversations || []

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return
    }

    try {
      await deleteMutation.mutateAsync(conversationId)
      toast.success('Conversation deleted successfully')
      refetch()
    } catch (err) {
      toast.error('Failed to delete conversation')
    }
  }

  const handleResume = (conv: Conversation) => {
    const repoId = (conv as any).repo_id || conv.repositoryId
    if (!repoId) {
      toast.error('This conversation is not bound to a repository workspace')
      return
    }

    setCurrentConversation(conv)
    if (conv.agentType) {
      setActiveAgent(conv.agentType)
    }
    router.push(`/repo/${repoId}`)
  }

  const filtered = list.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.agentType && c.agentType.toLowerCase().includes(search.toLowerCase())) ||
      ((c as any).repo_name && (c as any).repo_name.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-brand-400" />
          Conversations
        </h1>
        <p className="text-slate-400 text-sm">
          Access your past cross-session agent logs and repository understanding history.
        </p>
      </motion.div>

      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center gap-4"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06] text-slate-200"
          />
        </div>
      </motion.div>

      {/* List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-surface-950/20">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-2 w-2/3">
                    <Skeleton className="h-5 w-1/3" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed border-white/[0.08] py-12 text-center bg-transparent">
            <CardContent className="flex flex-col items-center justify-center space-y-3">
              <MessageSquare className="w-10 h-10 text-slate-500" />
              <div className="text-slate-300 font-semibold">No conversations found</div>
              <p className="text-xs text-slate-500 max-w-xs">
                Try searching for a different keyword or start a new chat in a repository workspace.
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((conv, i) => {
            const agent = AGENT_CONFIG[conv.agentType || 'understand'] || AGENT_CONFIG.understand
            const repoId = (conv as any).repo_id || conv.repositoryId
            const messageCount = conv.messageCount ?? (conv as any).message_count ?? 0
            const updatedAt = conv.updatedAt ?? (conv as any).updated_at ?? conv.createdAt ?? (conv as any).created_at

            return (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 + 0.15 }}
                whileHover={{ y: -2 }}
              >
                <Card className="hover:border-white/10 transition-all duration-200 bg-surface-950/20 group">
                  <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg" title={agent.label}>{agent.emoji}</span>
                        <h2 className="text-sm font-bold text-white group-hover:text-brand-300 transition-colors truncate">
                          {conv.title || 'Untitled Conversation'}
                        </h2>
                        {repoId && (
                          <Badge variant="secondary" className="text-[10px] bg-white/5 border border-white/5 text-slate-400">
                            <Database className="w-3 h-3 mr-1" />
                            Workspace
                          </Badge>
                        )}
                        <Badge className="text-[10px] bg-brand-500/10 text-brand-400 border border-brand-500/20">
                          {agent.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> Updated {formatRelativeTime(updatedAt)}
                        </span>
                        <span>•</span>
                        <span>{messageCount} messages</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        disabled={deleteMutation.isPending}
                        className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <Button
                        size="sm"
                        className="h-8 text-xs shadow-glow gap-1"
                        onClick={() => handleResume(conv)}
                      >
                        Resume Chat
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}
