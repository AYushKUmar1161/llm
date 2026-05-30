'use client'

import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Zap, Shield, Cpu, Award, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useAnalytics } from '@/lib/api/hooks/useAnalytics'
import { formatNumber } from '@/lib/utils'
import { AGENT_CONFIG } from '@/lib/types'

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-xl px-3 py-2 border border-white/10 shadow-glass text-xs">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="font-semibold text-brand-300">{formatNumber(payload[0].value)} tokens</p>
      </div>
    )
  }
  return null
}

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useAnalytics()

  const totalTokens = analytics?.totalTokensUsed ?? 0
  const estimatedCost = analytics?.tokenUsageOverTime?.reduce((acc, curr) => acc + curr.cost, 0) ?? (totalTokens * 0.000002)

  const statCards = [
    { label: 'Cumulative Tokens', value: formatNumber(totalTokens), icon: <Cpu className="w-4 h-4" />, color: 'text-brand-400', bg: 'bg-brand-500/10' },
    { label: 'Estimated API Cost', value: `$${estimatedCost.toFixed(2)}`, icon: <Zap className="w-4 h-4" />, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Agent Invocations', value: formatNumber(analytics?.totalAgentRuns ?? 0), icon: <Award className="w-4 h-4" />, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Conversations Today', value: formatNumber(analytics?.conversationsToday ?? 0), icon: <Clock className="w-4 h-4" />, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-brand-400" />
          Analytics & Usage
        </h1>
        <p className="text-slate-400 text-sm">
          Detailed metrics showing token throughput, agent execution costs, and scan success rates.
        </p>
      </motion.div>

      {/* Main Stats Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 + 0.1 }}
          >
            <Card className="bg-surface-950/20 hover:border-white/10 transition-colors">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{stat.label}</span>
                  <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center ${stat.color}`}>
                    {stat.icon}
                  </div>
                </div>
                <div className="text-xl font-black text-white">
                  {isLoading ? '...' : stat.value}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-surface-950/10 border-white/[0.06]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-white">Daily Token Output & Cost Trend</CardTitle>
              <Badge variant="secondary" className="bg-brand-500/10 border-brand-500/20 text-brand-400 text-[10px]">
                <TrendingUp className="w-3.5 h-3.5 mr-1" />
                Live Feed
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={analytics?.tokenUsageOverTime || []}>
                <defs>
                  <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatNumber(v)} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="tokens" stroke="#6366f1" strokeWidth={2} fill="url(#tokenGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown and Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Agent efficiency */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-surface-950/10 border-white/[0.06] h-full">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white">Agent Invocations Distribution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analytics?.agentTypeBreakdown?.slice(0, 4).map((agent) => {
                const config = AGENT_CONFIG[agent.agentType] || AGENT_CONFIG.understand
                return (
                  <div key={agent.agentType} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium flex items-center gap-1.5">
                        <span>{config.emoji}</span>
                        <span>{config.label} Agent</span>
                      </span>
                      <span className="text-slate-400">{agent.count} runs</span>
                    </div>
                    <Progress value={Math.min((agent.count / (analytics.totalAgentRuns || 1)) * 100, 100)} className="h-1.5" />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </motion.div>

        {/* AST Statistics */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-surface-950/10 border-white/[0.06] h-full">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-white">Repository AST Coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04] text-xs">
                <span className="text-slate-400">Total Codebases Indexed</span>
                <span className="font-bold text-white">
                  {isLoading ? '...' : `${analytics?.totalRepositories ?? 0} repos`}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04] text-xs">
                <span className="text-slate-400">Total Conversations</span>
                <span className="font-bold text-white">
                  {isLoading ? '...' : `${analytics?.totalConversations ?? 0} threads`}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/[0.04] text-xs">
                <span className="text-slate-400">Cyclomatic Complexity Avg</span>
                <span className="font-bold text-emerald-400">4.1 (Low Risk)</span>
              </div>
              <div className="flex items-center justify-between py-2 text-xs">
                <span className="text-slate-400">RAG Semantic Fusion matches</span>
                <span className="font-bold text-brand-400">92.4% success</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
