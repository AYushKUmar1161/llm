'use client'

import { useState } from 'react'
import {
  Folder, FolderOpen, File, FileJson, FileText,
  Search, ChevronRight, ChevronDown, Binary
} from 'lucide-react'
import { FileNode } from '@/lib/types'
import { useRepoStore } from '@/lib/stores/repoStore'
import { cn } from '@/lib/utils'

interface FileExplorerProps {
  repoId: string
}

export default function FileExplorer({ repoId }: FileExplorerProps) {
  const { fileTree, selectedFile, setSelectedFile, isLoadingTree } = useRepoStore()
  const [search, setSearch] = useState('')
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({
    '': true // expand root by default
  })

  const toggleExpand = (dirPath: string) => {
    setExpandedDirs((prev) => ({
      ...prev,
      [dirPath]: !prev[dirPath],
    }))
  }

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'json':
      case 'json5':
        return <FileJson className="w-4 h-4 text-amber-400" />
      case 'js':
      case 'jsx':
        return <File className="w-4 h-4 text-yellow-400" />
      case 'ts':
      case 'tsx':
        return <File className="w-4 h-4 text-blue-400" />
      case 'py':
        return <File className="w-4 h-4 text-sky-400" />
      case 'md':
        return <FileText className="w-4 h-4 text-emerald-400" />
      case 'html':
      case 'css':
        return <File className="w-4 h-4 text-orange-400" />
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'ico':
        return <File className="w-4 h-4 text-purple-400" />
      default:
        return <File className="w-4 h-4 text-slate-400" />
    }
  }

  // Recursive tree renderer
  const renderNode = (node: FileNode, depth = 0) => {
    const isDir = !!(node.isDir || node.is_dir || node.type === 'directory')
    const isExpanded = expandedDirs[node.path]
    const isSelected = selectedFile?.path === node.path

    const paddingLeft = `${depth * 12 + 8}px`

    // Filter by search query if set
    if (search) {
      const matchSearch = (n: FileNode): boolean => {
        if (n.name.toLowerCase().includes(search.toLowerCase())) return true
        if (n.children) {
          return n.children.some(child => matchSearch(child))
        }
        return false
      }

      if (!matchSearch(node)) return null
    }

    if (isDir) {
      return (
        <div key={node.path} className="space-y-0.5">
          <button
            onClick={() => toggleExpand(node.path)}
            style={{ paddingLeft }}
            className={cn(
              'flex items-center gap-1.5 w-full py-1 text-xs text-slate-300 hover:bg-white/5 rounded transition-colors text-left font-medium'
            )}
          >
            <span className="text-slate-500">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
            <span className="text-brand-400">
              {isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
            </span>
            <span className="truncate flex-1">{node.name}</span>
            {node.children && (
              <span className="text-[10px] text-slate-500 pr-2">
                {node.children.length}
              </span>
            )}
          </button>

          {isExpanded && node.children && (
            <div className="space-y-0.5">
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </div>
      )
    }

    return (
      <button
        key={node.path}
        onClick={() => setSelectedFile(node)}
        style={{ paddingLeft }}
        className={cn(
          'flex items-center gap-1.5 w-full py-1 text-xs text-slate-400 hover:bg-white/5 hover:text-slate-200 rounded transition-colors text-left',
          isSelected && 'bg-brand-500/10 text-brand-300 hover:text-brand-200 border-l-2 border-brand-500 rounded-l-none pl-[calc(depth*12+6px)]'
        )}
      >
        <span className="w-3.5 h-3.5" /> {/* empty space to align with folder icons */}
        <span>{getFileIcon(node.name)}</span>
        <span className="truncate flex-1">{node.name}</span>
        {node.size && (
          <span className="text-[9px] text-slate-600 pr-2">
            {(node.size / 1024).toFixed(1)}k
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full bg-surface-950/20">
      {/* File Search */}
      <div className="p-3 border-b border-white/[0.04]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded bg-white/[0.03] border border-white/[0.06] text-xs text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-all"
          />
        </div>
      </div>

      {/* Explorer Tree */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {isLoadingTree ? (
          <div className="space-y-2 p-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-3.5 h-3.5 bg-white/5 rounded animate-pulse" />
                <div className="w-4 h-4 bg-white/5 rounded animate-pulse" />
                <div className="h-3 bg-white/5 rounded animate-pulse flex-1" />
              </div>
            ))}
          </div>
        ) : fileTree && fileTree.length > 0 ? (
          <div className="space-y-0.5">
            {fileTree.map(node => renderNode(node))}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-slate-500">
            No files found
          </div>
        )}
      </div>
    </div>
  )
}
