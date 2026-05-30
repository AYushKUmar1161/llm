'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Copy, Check, FileCode, ChevronDown, ChevronRight,
  Shield, Cpu, AlertTriangle, Code, Play
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Message, AGENT_CONFIG } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [sourcesOpen, setSourcesOpen] = useState(false)

  const copyToClipboard = (text: string, blockId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(blockId)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const agentConfig = AGENT_CONFIG[message.agentType as keyof typeof AGENT_CONFIG] || {
    label: message.agentType || 'Orchestrator',
    emoji: '🤖',
    color: 'text-brand-400 bg-brand-500/10 border-brand-500/20',
  }

  // Helper to render unified diffs in feature engineer output
  const renderDiffLine = (line: string, index: number) => {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      return (
        <div key={index} className="bg-emerald-500/10 text-emerald-300 px-2 py-0.5 border-l-2 border-emerald-500 font-mono text-xs">
          {line}
        </div>
      )
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      return (
        <div key={index} className="bg-red-500/10 text-red-300 px-2 py-0.5 border-l-2 border-red-500 font-mono text-xs line-through">
          {line}
        </div>
      )
    } else if (line.startsWith('@@')) {
      return (
        <div key={index} className="bg-brand-500/5 text-brand-300/60 px-2 py-0.5 font-mono text-[10px]">
          {line}
        </div>
      )
    }
    return (
      <div key={index} className="text-slate-400 px-2 py-0.5 font-mono text-xs">
        {line}
      </div>
    )
  }

  const renderCodeBlock = (code: string, language: string) => {
    const blockId = Math.random().toString(36).substring(7)
    const isDiff = language === 'diff' || code.includes('\n+') || code.includes('\n-')

    if (isDiff) {
      const lines = code.split('\n')
      return (
        <div className="my-4 rounded-xl border border-white/[0.06] overflow-hidden bg-surface-950">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-white/[0.02]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-brand-400" /> code-diff-patch
            </span>
            <button
              onClick={() => copyToClipboard(code, blockId)}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {copiedCode === blockId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="py-2 overflow-x-auto max-h-[480px] scrollbar-thin">
            {lines.map((line, idx) => renderDiffLine(line, idx))}
          </div>
        </div>
      )
    }

    return (
      <div className="my-4 rounded-xl border border-white/[0.06] overflow-hidden bg-surface-950">
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-white/[0.02]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
            {language || 'code'}
          </span>
          <button
            onClick={() => copyToClipboard(code, blockId)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            {copiedCode === blockId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
        <pre className="p-4 overflow-x-auto text-xs font-mono text-slate-300 max-h-[360px] scrollbar-thin">
          <code>{code}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className={cn('flex w-full mb-6', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] sm:max-w-[75%]', isUser ? 'order-1' : 'order-2')}>
        {/* Agent badge for assistant response */}
        {!isUser && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{agentConfig.emoji}</span>
            <span className="text-xs font-black text-white">{agentConfig.label}</span>
            <span className="text-[10px] text-slate-500">• {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}

        {/* Message Card bubble */}
        <Card
          className={cn(
            'p-4 border',
            isUser
              ? 'bg-brand-gradient text-white border-brand-500/20 shadow-glow rounded-2xl rounded-tr-none'
              : 'glass border-white/[0.06] shadow-glass rounded-2xl rounded-tl-none bg-surface-950/20'
          )}
        >
          {isUser ? (
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
          ) : (
            <div className="text-sm leading-relaxed prose prose-invert max-w-none text-slate-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    return match ? (
                      renderCodeBlock(String(children).replace(/\n$/, ''), match[1])
                    ) : (
                      <code className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-brand-300 font-mono" {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </Card>

        {/* Source References list */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-2 pl-1">
            <button
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
            >
              {sourcesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Referenced {message.sources.length} file{message.sources.length > 1 ? 's' : ''}
            </button>

            {sourcesOpen && (
              <div className="mt-2 grid sm:grid-cols-2 gap-2">
                {message.sources.map((src: any, idx: number) => (
                  <div
                    key={idx}
                    className="glass border border-white/[0.04] rounded-lg p-2 flex items-start gap-2 bg-surface-950/10"
                  >
                    <FileCode className="w-4 h-4 text-brand-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-slate-300 truncate">{src.file || src.file_path || 'unknown'}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5">
                        Lines {src.start_line || src.start || 1}-{src.end_line || src.end || 1}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
