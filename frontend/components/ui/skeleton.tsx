import * as React from 'react'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-white/[0.06] shimmer',
        'bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04]',
        'bg-[length:200%_100%]',
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
