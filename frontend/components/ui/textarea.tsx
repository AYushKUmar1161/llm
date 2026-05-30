import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border bg-white/[0.04] px-3 py-2.5',
            'text-sm text-slate-200 placeholder:text-slate-500',
            'border-white/[0.08] focus:border-brand-500/50',
            'focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            'transition-all duration-200 resize-none',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'scrollbar-none',
            error && 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/20',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = 'Textarea'

export { Textarea }
