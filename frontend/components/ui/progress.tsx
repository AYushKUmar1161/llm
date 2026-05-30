import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@/lib/utils'

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    variant?: 'default' | 'success' | 'warning' | 'danger'
  }
>(({ className, value, variant = 'default', ...props }, ref) => {
  const indicatorColors = {
    default: 'bg-brand-gradient',
    success: 'bg-gradient-to-r from-emerald-500 to-green-400',
    warning: 'bg-gradient-to-r from-amber-500 to-yellow-400',
    danger: 'bg-gradient-to-r from-red-500 to-rose-400',
  }

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06]',
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full w-full flex-1 rounded-full transition-all duration-500 ease-out',
          indicatorColors[variant]
        )}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
