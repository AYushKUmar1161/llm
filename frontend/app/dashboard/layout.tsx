'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, GitBranch, MessageSquare, BarChart3, Settings,
  Cpu, ChevronLeft, ChevronRight, Bell, Search, LogOut,
  User, ChevronDown, Menu, X, Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '@/lib/stores/authStore'
import { getInitials } from '@/lib/utils'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/repositories', icon: GitBranch, label: 'Repositories' },
  { href: '/conversations', icon: MessageSquare, label: 'Conversations' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn(
        'flex items-center h-16 px-4 border-b border-white/[0.06] flex-shrink-0',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <div className="w-8 h-8 bg-brand-gradient rounded-lg flex items-center justify-center shadow-glow flex-shrink-0">
          <Cpu className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-bold text-white text-sm">
            Code<span className="gradient-text">Forge</span>
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-none">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  'nav-item',
                  isActive && 'active',
                  collapsed && 'justify-center px-2'
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Upgrade banner */}
      {!collapsed && (
        <div className="mx-3 mb-3 p-3 rounded-xl bg-brand-500/10 border border-brand-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-brand-400" />
            <span className="text-xs font-semibold text-brand-300">Upgrade to Pro</span>
          </div>
          <p className="text-xs text-slate-400 mb-2">Unlimited repos & priority AI models.</p>
          <Button size="sm" className="w-full text-xs h-7">Upgrade</Button>
        </div>
      )}

      {/* User */}
      <div className={cn(
        'p-3 border-t border-white/[0.06] flex-shrink-0',
        collapsed && 'flex justify-center'
      )}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              'flex items-center gap-3 w-full rounded-lg p-2 hover:bg-white/5 transition-colors text-left group',
              collapsed && 'w-auto justify-center'
            )}>
              <Avatar className="w-8 h-8 flex-shrink-0">
                <AvatarImage src={user?.avatarUrl} />
                <AvatarFallback className="text-xs">{user?.name ? getInitials(user.name) : 'U'}</AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-200 truncate">{user?.name || 'User'}</div>
                    <div className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" className="w-48 mb-1">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile" className="gap-2 cursor-pointer">
                <User className="w-4 h-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" className="gap-2 cursor-pointer">
                <Settings className="w-4 h-4" /> Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-300 gap-2 cursor-pointer">
              <LogOut className="w-4 h-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="hidden lg:flex flex-col glass-strong border-r border-white/[0.05] relative z-20 flex-shrink-0"
      >
        {sidebarContent}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-surface-800 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-surface-700 transition-all z-30 shadow-glass"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 w-60 glass-strong border-r border-white/[0.05] z-40 lg:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 glass border-b border-white/[0.05] flex items-center px-4 gap-4 flex-shrink-0 z-10">
          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search repositories, conversations..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-all"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-600 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 hidden sm:block">
                ⌘K
              </kbd>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500 border-2 border-surface-950" />
            </button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarImage src={user?.avatarUrl} />
                    <AvatarFallback className="text-xs">{user?.name ? getInitials(user.name) : 'U'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-slate-300 hidden sm:block">{user?.name?.split(' ')[0] || 'User'}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <User className="w-4 h-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <Settings className="w-4 h-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-300 gap-2 cursor-pointer">
                  <LogOut className="w-4 h-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
