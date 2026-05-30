'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  GitBranch, MessageSquare, Zap, Shield, Bot, TrendingUp,
  Plus, ArrowRight, Clock, Activity, Cpu, BarChart3
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalytics } from '@/lib/api/hooks/useAnalytics'
import { useAuthStore } from '@/lib/stores/authStore'
import { formatNumber, formatRelativeTime } from '@/lib/utils'
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

const quickActions = [
  {
    icon: <GitBranch className="w-5 h-5" />,
    label: 'Connect Repo',
    description: 'Index a new GitHub repository',
    href: '/repositories?connect=true',
    color: 'from-brand-500/20 to-violet-500/10',
    iconColor: 'text-brand-400',
    iconBg: 'bg-brand-500/15',
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    label: 'Start Chat',
    description: 'Ask your AI engineer anything',
    href: '/repositories',
    color: 'from-cyan-500/20 to-sky-500/10',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    label: 'Security Scan',
    description: 'Scan for vulnerabilities',
    href: '/repositories',
    color: 'from-red-500/20 to-rose-500/10',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/15',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    label: 'Generate Docs',
    description: 'Auto-document your codebase',
    href: '/repositories',
    color: 'from-emerald-500/20 to-green-500/10',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
  },
]

export default function DashboardPage() {
  const { data: analytics, isLoading } = useAnalytics()
  const { user } = useAuthStore()

  const statCards = [
    {
      label: 'Total Repositories',
      value: analytics?.totalRepositories ?? 0,
      icon: <GitBranch className="w-5 h-5" />,
      change: '+2 this week',
      color: 'text-brand-400',
      bg: 'bg-brand-500/15',
      border: 'border-brand-500/20',
    },
    {
      label: 'Conversations Today',
      value: analytics?.conversationsToday ?? 0,
      icon: <MessageSquare className="w-5 h-5" />,
      change: '+5 from yesterday',
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/15',
      border: 'border-cyan-500/20',
    },
    {
      label: 'Tokens Used',
      value: analytics?.tokensToday ?? 0,
      format: 'number',
      icon: <Cpu className="w-5 h-5" />,
      change: '~$0.42 cost today',
      color: 'text-violet-400',
      bg: 'bg-violet-500/15',
      border: 'border-violet-500/20',
    },
    {
      label: 'Agent Runs',
      value: analytics?.agentRunsToday ?? 0,
      icon: <Bot className="w-5 h-5" />,
      change: 'All agents active',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/15',
      border: 'border-emerald-500/20',
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-white">
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},{' '}
            <span className="gradient-text">{user?.name?.split(' ')[0] || 'Developer'}</span> 👋
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Here&apos;s what&apos;s happening with your AI engineer today.</p>
        </div>
        <Link href="/repositories?connect=true">
          <Button size="sm" className="gap-2 shadow-glow hidden sm:flex">
            <Plus className="w-4 h-4" />
            Connect Repo
          </Button>
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className={`hover:border-white/10 group transition-all duration-300 gradient-border`}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center ${stat.color}`}>
                    {stat.icon}
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-400 opacity-60" />
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-20 mb-1" />
                ) : (
                  <div className="text-2xl font-black text-white mb-1">
                    {formatNumber(stat.value)}
                  </div>
                )}
                <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
                <div className="text-xs text-emerald-400">{stat.change}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Token usage chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Token Usage (30 days)</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  <Activity className="w-3 h-3 mr-1" />
                  Live
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analytics?.tokenUsageOverTime?.slice(-14) || []}>
                    <defs>
                      <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => v.slice(5)}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatNumber(v)}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      width={45}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="tokens"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fill="url(#tokenGradient)"
                      dot={false}
                      activeDot={{ r: 4, fill: '#6366f1', stroke: '#0c0e14', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Agent breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agent Usage</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics?.agentTypeBreakdown || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => String(v)}
                      tick={{ fontSize: 10, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="agentType"
                      tickFormatter={(v) => AGENT_CONFIG[v as keyof typeof AGENT_CONFIG]?.emoji + ' ' + AGENT_CONFIG[v as keyof typeof AGENT_CONFIG]?.label}
                      tick={{ fontSize: 9, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15,18,26,0.95)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#f1f5f9',
                      }}
                    />
                    <Bar dataKey="count" fill="url(#barGradient)" radius={[0, 4, 4, 0]} />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <h2 className="text-base font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-brand-400" />
          Quick Actions
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.55 + i * 0.05 }}
              whileHover={{ y: -3 }}
            >
              <Link href={action.href}>
                <div className={`glass rounded-xl p-5 border border-white/[0.06] hover:border-white/[0.12] cursor-pointer group transition-all duration-200 bg-gradient-to-br ${action.color} relative overflow-hidden`}>
                  <div className={`w-10 h-10 rounded-xl ${action.iconBg} flex items-center justify-center ${action.iconColor} mb-3 group-hover:scale-110 transition-transform`}>
                    {action.icon}
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">{action.label}</div>
                  <div className="text-xs text-slate-400">{action.description}</div>
                  <ArrowRight className="w-4 h-4 text-slate-500 absolute bottom-4 right-4 group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Recent Activity
              </CardTitle>
              <Link href="/analytics" className="text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Demo activity items */}
                {[
                  { icon: '🏛', label: 'Architect analysis completed', repo: 'my-saas-app', time: '2m ago', status: 'completed' },
                  { icon: '🔒', label: 'Security scan found 0 issues', repo: 'backend-api', time: '15m ago', status: 'safe' },
                  { icon: '⚙️', label: 'Feature: auth middleware generated', repo: 'api-gateway', time: '1h ago', status: 'completed' },
                  { icon: '🧪', label: '12 unit tests generated', repo: 'my-saas-app', time: '3h ago', status: 'completed' },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-base flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 truncate">{item.label}</div>
                      <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                        <GitBranch className="w-3 h-3" />
                        {item.repo}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 flex-shrink-0">{item.time}</div>
                    <Badge variant={item.status === 'safe' ? 'success' : 'default'} className="text-xs flex-shrink-0">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
