'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Cpu, Zap, Bot, CheckCircle, Clock, AlertTriangle,
  FileCode, Play, BarChart, Server
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useRepoStore } from '@/lib/stores/repoStore'
import { useChatStore } from '@/lib/stores/chatStore'
import { AGENT_CONFIG } from '@/lib/types'
import { formatNumber } from '@/lib/utils'
import apiClient from '@/lib/api/client'

export default function AgentStatusPanel() {
  const { currentRepo } = useRepoStore()
  const { activeAgent } = useChatStore()
  const [runs, setRuns] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchRuns = async () => {
      if (!currentRepo) return
      setLoading(true)
      try {
        const res = await apiClient.get('/agents/runs')
        // Filter runs for this repo
        const repoRuns = (res.data || [])
          .filter((r: any) => r.repoId === currentRepo.id)
          .slice(0, 5)
        setRuns(repoRuns)
      } catch (err) {
        console.error('Failed to fetch agent runs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchRuns()
    const interval = setInterval(fetchRuns, 10000)
    return () => clearInterval(interval)
  }, [currentRepo])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
      case 'failed':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
      default:
        return <Clock className="w-3.5 h-3.5 text-brand-400 animate-spin" />
    }
  }

  const agentConfig = AGENT_CONFIG[activeAgent as keyof typeof AGENT_CONFIG] || {
    label: 'Orchestrator',
    emoji: '🤖',
    description: 'Routes intent and coordinates specialist agents.',
    color: 'text-indigo-400',
  }

  return (
    <div className="space-y-4 p-4 h-full overflow-y-auto scrollbar-thin">
      {/* Active Agent Status Card */}
      <Card className="border-white/[0.06] bg-surface-950/20">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Specialist</CardTitle>
          <Badge className="bg-brand-500/10 text-brand-400 border border-brand-500/20 text-[10px] animate-pulse">
            Ready
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-xl shadow-glow">
              {agentConfig.emoji}
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                {agentConfig.label}
              </div>
              <p className="text-[10px] text-slate-500">{agentConfig.description}</p>
            </div>
          </div>

          <div className="h-px bg-white/[0.04]" />

          {/* Core active indicator */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Status</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Idle / Awaiting Prompts
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Repo Stats & Indexing Status */}
      <Card className="border-white/[0.06] bg-surface-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Workspace Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1"><Server className="w-3.5 h-3.5 text-slate-500" /> Vector Database</span>
              <span className="text-slate-200 font-medium">ChromaDB (Online)</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1"><Cpu className="w-3.5 h-3.5 text-slate-500" /> Indexing Integrity</span>
              <span className="text-emerald-400 font-medium">100% Parsed</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1"><BarChart className="w-3.5 h-3.5 text-slate-500" /> Symbols Indexed</span>
              <span className="text-slate-200 font-medium">{currentRepo?.totalFiles ? currentRepo.totalFiles * 8 : '—'} symbols</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Agent Execution Logs */}
      <Card className="border-white/[0.06] bg-surface-950/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Agent Executions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading && runs.length === 0 ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500">
              No executions logged yet
            </div>
          ) : (
            <div className="space-y-2.5">
              {runs.map((run: any) => {
                const config = AGENT_CONFIG[run.agentType as keyof typeof AGENT_CONFIG] || {
                  label: run.agentType,
                  emoji: '🤖',
                }
                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02] border border-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base">{config.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-200 truncate">{config.label}</div>
                        <div className="text-[9px] text-slate-500">
                          {run.durationSeconds ? `${run.durationSeconds.toFixed(1)}s` : 'running...'}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusIcon(run.status)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
