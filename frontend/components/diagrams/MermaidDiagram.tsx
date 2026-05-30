'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface MermaidDiagramProps {
  chart: string
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<boolean>(false)
  const [zoom, setZoom] = useState<number>(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const elementId = useRef(`mermaid-${Math.floor(Math.random() * 100000)}`)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleReset = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  useEffect(() => {
    const renderChart = async () => {
      if (!chart) return
      setError(false)
      setSvg('')

      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          securityLevel: 'loose',
          themeVariables: {
            background: '#0c0e14',
            primaryColor: '#6366f1',
            primaryTextColor: '#f1f5f9',
            lineColor: '#475569',
            secondaryColor: '#1e1b4b',
            tertiaryColor: '#0f172a',
          },
        })

        const { svg: renderedSvg } = await mermaid.render(elementId.current, chart)
        setSvg(renderedSvg)
      } catch (err) {
        console.error('Mermaid render failed:', err)
        setError(true)
      }
    }

    renderChart()
  }, [chart])

  const downloadSVG = () => {
    if (!svg) return
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `architecture-${elementId.current}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-red-500/5 border border-red-500/20 rounded-xl text-center">
        <p className="text-sm font-semibold text-red-400">Failed to render architecture diagram</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm truncate">Syntax error or unsupported Mermaid directives.</p>
        <pre className="text-[10px] text-slate-600 bg-black/25 rounded p-2 mt-3 text-left overflow-auto max-w-full max-h-40">
          {chart}
        </pre>
      </div>
    )
  }

  return (
    <div className="relative glass rounded-xl border border-white/[0.06] overflow-hidden bg-surface-950/40">
      {/* Header controls */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur-md border border-white/5 rounded-lg p-1">
        <button
          onClick={() => setZoom(Math.max(0.5, zoom - 0.15))}
          title="Zoom Out"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom(Math.min(2.5, zoom + 0.15))}
          title="Zoom In"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleReset}
          title="Reset View"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-[10px] px-1 font-semibold"
        >
          Reset
        </button>
        <div className="w-px h-3.5 bg-white/10 mx-0.5" />
        <button
          onClick={downloadSVG}
          title="Download as SVG"
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Render SVG with interactive panning/zoom canvas */}
      <div 
        className="p-8 flex items-center justify-center min-h-[350px] overflow-hidden select-none bg-surface-950/20"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {svg ? (
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            style={{ 
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
              transformOrigin: 'center center',
              cursor: isDragging ? 'grabbing' : 'grab' 
            }}
            className="transition-transform duration-75 select-none"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="space-y-3 w-full max-w-sm text-center">
            <Skeleton className="h-6 w-3/4 mx-auto" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-6 w-1/2 mx-auto" />
          </div>
        )}
      </div>
    </div>
  )
}
