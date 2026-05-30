'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch, Code, Shield, CheckCircle, FileCode,
  Layout, Cpu, Activity, Play, ChevronLeft, ChevronRight,
  BookOpen, Star, AlertTriangle, Layers, Award
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'react-hot-toast'
import FileExplorer from '@/components/repo/FileExplorer'
import ChatInterface from '@/components/chat/ChatInterface'
import AgentStatusPanel from '@/components/chat/AgentStatusPanel'
import MermaidDiagram from '@/components/diagrams/MermaidDiagram'
import { useRepoStore } from '@/lib/stores/repoStore'
import { useChatStore } from '@/lib/stores/chatStore'
import { formatNumber } from '@/lib/utils'

export default function WorkspacePage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

  const {
    currentRepo, architectureReport, isLoadingRepo,
    fetchRepo, fetchFileTree, fetchArchitecture, error
  } = useRepoStore()
  const { resetChat } = useChatStore()

  useEffect(() => {
    if (!id) return
    resetChat()

    const loadWorkspace = async () => {
      try {
        await Promise.all([
          fetchRepo(id),
          fetchFileTree(id),
          fetchArchitecture(id)
        ])
      } catch (err) {
        toast.error('Failed to load workspace data')
      }
    }

    loadWorkspace()
  }, [id])

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 bg-surface-950 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Failed to load repository workspace</h3>
          <p className="text-sm text-slate-400 mt-1 max-w-md">{error}</p>
        </div>
        <Button onClick={() => router.push('/repositories')} className="shadow-glow">
          Back to Repositories
        </Button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-surface-950">
      {/* Top Workspace Header Bar */}
      <header className="h-14 border-b border-white/[0.05] bg-surface-900/10 px-4 flex items-center justify-between flex-shrink-0 relative z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push('/repositories')}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 bg-brand-500/10 border border-brand-500/20 rounded flex items-center justify-center text-brand-400">
              <GitBranch className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              {isLoadingRepo ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <h1 className="text-sm font-bold text-white truncate">{currentRepo?.name}</h1>
              )}
              <p className="text-[10px] text-slate-500 truncate hidden sm:block">{currentRepo?.fullName}</p>
            </div>
          </div>
        </div>

        {/* Tech Badges */}
        {!isLoadingRepo && currentRepo?.techStack && (
          <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {Object.keys(currentRepo.techStack).slice(0, 4).map((tech) => (
              <Badge key={tech} variant="secondary" className="text-[10px] bg-white/5 border border-white/5">
                {tech}
              </Badge>
            ))}
          </div>
        )}
      </header>

      {/* Main Workspace Panels Layout */}
      <div className="flex-1 flex overflow-hidden min-w-0 relative">
        {/* LEFT PANEL: File Explorer & Architecture */}
        <AnimatePresence initial={false}>
          {!leftPanelCollapsed && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="h-full border-r border-white/[0.05] glass bg-surface-900/10 flex flex-col flex-shrink-0 relative z-20"
            >
              <Tabs defaultValue="explorer" className="flex flex-col h-full">
                <TabsList className="grid grid-cols-2 rounded-none border-b border-white/[0.04] bg-transparent p-0 h-10 flex-shrink-0">
                  <TabsTrigger
                    value="explorer"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-500 data-[state=active]:bg-transparent text-xs font-semibold"
                  >
                    <Code className="w-3.5 h-3.5 mr-1.5" /> Explorer
                  </TabsTrigger>
                  <TabsTrigger
                    value="architecture"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-500 data-[state=active]:bg-transparent text-xs font-semibold"
                  >
                    <Layers className="w-3.5 h-3.5 mr-1.5" /> Architect
                  </TabsTrigger>
                </TabsList>

                {/* File Explorer Tab Content */}
                <TabsContent value="explorer" className="flex-1 overflow-hidden m-0 p-0">
                  <FileExplorer repoId={id} />
                </TabsContent>

                {/* Architectural Reports Tab Content */}
                <TabsContent value="architecture" className="flex-1 overflow-y-auto m-0 p-4 space-y-4 scrollbar-thin">
                  {currentRepo?.indexStatus !== 'ready' ? (
                    <div className="text-center py-12 space-y-3">
                      <Cpu className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
                      <div>
                        <h4 className="text-xs font-bold text-white">Generating Blueprint</h4>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto">
                          Please wait for indexing to finish to generate complete ADR designs.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary card */}
                      <Card className="border-white/[0.06] bg-surface-950/20">
                        <CardContent className="pt-4 pb-4">
                          <h3 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider mb-2">
                            <Award className="w-3.5 h-3.5 text-brand-400" /> Blueprint Overview
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {architectureReport?.summary || 'Blueprint analysis compiled successfully.'}
                          </p>
                        </CardContent>
                      </Card>

                      {/* Tech details */}
                      {currentRepo.techStack && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Frameworks & Modules</h4>
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(currentRepo.techStack).map(([tech, detail]: any) => (
                              <Badge key={tech} className="bg-white/5 border border-white/5 text-[10px]">
                                {tech}: {typeof detail === 'string' ? detail : 'Active'}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Architecture graph rendering */}
                      {architectureReport?.mermaid_diagram && (
                        <div className="space-y-2 pt-2">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Mermaid Dependency flow</h4>
                          <MermaidDiagram chart={architectureReport.mermaid_diagram} />
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Collapsible toggle triggers */}
        <button
          onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
          className="absolute left-0 top-[20%] z-30 w-4 h-12 glass border border-l-0 border-white/[0.08] hover:bg-white/5 text-slate-500 flex items-center justify-center rounded-r-lg transition-colors cursor-pointer"
        >
          {leftPanelCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* CENTER PANEL: Main Streaming Chat Workspace */}
        <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0 bg-surface-900/5 relative z-10">
          <ChatInterface repoId={id} />
        </main>

        {/* Collapsible right panel toggle triggers */}
        <button
          onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
          className="absolute right-0 top-[20%] z-30 w-4 h-12 glass border border-r-0 border-white/[0.08] hover:bg-white/5 text-slate-500 flex items-center justify-center rounded-l-lg transition-colors cursor-pointer"
        >
          {rightPanelCollapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        {/* RIGHT PANEL: Agent Status and Runs Logs */}
        <AnimatePresence initial={false}>
          {!rightPanelCollapsed && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="h-full border-l border-white/[0.05] glass bg-surface-900/10 flex flex-col flex-shrink-0 relative z-20"
            >
              <AgentStatusPanel />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
