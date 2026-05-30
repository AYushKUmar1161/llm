import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 border',
  {
    variants: {
      variant: {
        default: 'bg-brand-500/15 text-brand-400 border-brand-500/25',
        secondary: 'bg-white/5 text-slate-400 border-white/10',
        destructive: 'bg-red-500/15 text-red-400 border-red-500/25',
        success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
        warning: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
        info: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
        cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
        violet: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
        outline: 'border-white/15 text-slate-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

// Language badge with color dot
interface LanguageBadgeProps {
  language: string
  className?: string
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Scala: '#c22d40',
  R: '#198CE7',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
}

function LanguageBadge({ language, className }: LanguageBadgeProps) {
  const color = LANGUAGE_COLORS[language] || '#6366f1'
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border border-white/10 bg-white/5 text-slate-300',
        className
      )}
    >
      <span
        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {language}
    </div>
  )
}

export { Badge, badgeVariants, LanguageBadge }
