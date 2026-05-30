'use client'

import { useState, useEffect, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  GitBranch, Plus, Trash2, RefreshCw, ExternalLink,
  Search, ShieldAlert, Cpu, CheckCircle2, AlertCircle,
  FileCode, Terminal, X, ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'react-hot-toast'
import {
  useRepositories,
  useConnectRepository,
  useDeleteRepository,
  useReindexRepository
} from '@/lib/api/hooks/useRepositories'
import { Repository } from '@/lib/types'
import { formatRelativeTime } from '@/lib/utils'

function RepositoriesContent() {
  const searchParams = useSearchParams()
  const [connectOpen, setConnectOpen] = useState(false)
  const [githubUrl, setGithubUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [search, setSearch] = useState('')

  const { data: repoData, isLoading, refetch } = useRepositories()
  const connectMutation = useConnectRepository()
  const deleteMutation = useDeleteRepository()
  const reindexMutation = useReindexRepository()

  const repos = Array.isArray(repoData)
    ? repoData
    : (repoData as any)?.data || (repoData as any)?.items || []

  useEffect(() => {
    if (searchParams.get('connect') === 'true') {
      setConnectOpen(true)
    }
  }, [searchParams])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!githubUrl) {
      toast.error('Please enter a GitHub repository URL')
      return
    }

    try {
      await connectMutation.mutateAsync({
        github_url: githubUrl,
        default_branch: branch,
      })
      toast.success('Repository connected! Starting indexing...')
      setGithubUrl('')
      setConnectOpen(false)
      refetch()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to connect repository')
    }
  }

  const handleDelete = async (repoId: string) => {
    if (!confirm('Are you sure you want to disconnect this repository? All indexing data, logs, and memory will be lost.')) {
      return
    }

    try {
      await deleteMutation.mutateAsync(repoId)
      toast.success('Repository disconnected successfully')
      refetch()
    } catch (err) {
      toast.error('Failed to disconnect repository')
    }
  }

  const handleReindex = async (repoId: string) => {
    try {
      await reindexMutation.mutateAsync(repoId)
      toast.success('Re-indexing triggered successfully')
      refetch()
    } catch (err) {
      toast.error('Failed to trigger re-indexing')
    }
  }

  const getStatusBadge = (status: Repository['indexStatus'], progress: number) => {
    switch (status) {
      case 'ready':
        return (
          <Badge variant="success" className="gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready
          </Badge>
        )
      case 'indexing':
        return (
          <Badge variant="warning" className="gap-1 bg-brand-500/10 text-brand-400 border border-brand-500/20 animate-pulse">
            <Cpu className="w-3.5 h-3.5 animate-spin" /> Indexing ({progress}%)
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5" /> Failed
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="gap-1 bg-slate-500/10 text-slate-400 border border-slate-500/20">
            <ClockIcon className="w-3.5 h-3.5" /> Pending
          </Badge>
        )
    }
  }

  const filteredRepos = repos.filter((repo: Repository) =>
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (repo.language && repo.language.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Connected Repositories</h1>
          <p className="text-slate-400 mt-1 text-sm">Connect, index, and manage your source code workspaces.</p>
        </div>
        <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-glow w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              Connect Repository
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Connect Repository</DialogTitle>
              <DialogDescription>
                Index a new GitHub repository to chat with it, run scans, or write tests.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleConnect} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="githubUrl" className="text-xs font-semibold text-slate-300">GitHub URL</Label>
                <Input
                  id="githubUrl"
                  placeholder="https://github.com/username/repository"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08]"
                />
                <p className="text-[10px] text-slate-500">Supports HTTPS and SSH format. Works with public and authorized repos.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="branch" className="text-xs font-semibold text-slate-300">Default Branch</Label>
                <Input
                  id="branch"
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setConnectOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={connectMutation.isPending} className="shadow-glow">
                  {connectMutation.isPending ? 'Connecting...' : 'Connect & Index'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Toolbar */}
      <div className="flex items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Filter connected repositories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white/[0.03] border-white/[0.06]"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-64">
              <CardContent className="pt-6 flex flex-col justify-between h-full">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredRepos.length === 0 ? (
        <Card className="border-dashed border-white/[0.08] py-12 text-center bg-transparent">
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
              <GitBranch className="w-6 h-6" />
            </div>
            <div className="max-w-sm">
              <h3 className="text-lg font-bold text-white mb-1">No repositories connected</h3>
              <p className="text-sm text-slate-400">Connect a GitHub repository to get started with repository-level code intelligence.</p>
            </div>
            <Button onClick={() => setConnectOpen(true)} className="shadow-glow gap-1">
              Connect one now <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRepos.map((repo: Repository) => (
            <motion.div
              key={repo.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="h-full hover:border-white/10 group transition-all duration-300 gradient-border flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-white truncate flex items-center gap-1.5 group-hover:text-brand-300 transition-colors">
                        <GitBranch className="w-4.5 h-4.5 text-brand-400 flex-shrink-0" />
                        {repo.name}
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{repo.fullName}</p>
                    </div>
                    {getStatusBadge(repo.indexStatus, repo.indexProgress || 0)}
                  </div>
                </CardHeader>
                <CardContent className="pb-6 flex-1 flex flex-col justify-between space-y-4">
                  <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                    {repo.description || 'No repository description available.'}
                  </p>

                  {/* Index progress bar */}
                  {repo.indexStatus === 'indexing' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Parsing AST & Embedding...</span>
                        <span>{repo.indexProgress}%</span>
                      </div>
                      <Progress value={repo.indexProgress} className="h-1.5" />
                    </div>
                  )}

                  {/* Stats list */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/[0.04] text-center">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Language</div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                        {repo.language || 'Multi'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Files</div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">
                        {repo.totalFiles || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Total Lines</div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5">
                        {repo.totalLines ? repo.totalLines.toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <ClockIcon className="w-3 h-3" />
                      {repo.indexedAt ? `Indexed ${formatRelativeTime(repo.indexedAt)}` : 'Not indexed yet'}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleReindex(repo.id)}
                        disabled={repo.indexStatus === 'indexing'}
                        title="Force Re-index"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors disabled:opacity-40"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(repo.id)}
                        title="Disconnect Repo"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {repo.indexStatus === 'ready' ? (
                        <Link href={`/repo/${repo.id}`}>
                          <Button size="sm" className="h-8 gap-1 ml-1 text-xs shadow-glow">
                            Open Workspace
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      ) : (
                        <Button size="sm" disabled className="h-8 gap-1 ml-1 text-xs opacity-50">
                          Workspace
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RepositoriesPage() {
  return (
    <Suspense fallback={
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white">Connected Repositories</h1>
            <p className="text-slate-400 mt-1 text-sm">Loading connected repositories...</p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="h-64 bg-transparent border-white/[0.04]">
              <CardContent className="pt-6 flex flex-col justify-between h-full">
                <div className="space-y-3">
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-1/3" />
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    }>
      <RepositoriesContent />
    </Suspense>
  )
}

function ClockIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
