'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Github, Cpu, Eye, EyeOff, Mail, Lock, ArrowRight, Sparkles, Code2, Zap, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/authStore'
import toast from 'react-hot-toast'

const codeLines = [
  { code: 'const agent = new ArchitectAgent()', color: 'text-blue-400' },
  { code: '  .withModel("gpt-4o")', color: 'text-purple-400' },
  { code: '  .withRAG(vectorStore)', color: 'text-cyan-400' },
  { code: '', color: '' },
  { code: 'const analysis = await agent.run({', color: 'text-slate-300' },
  { code: '  query: "How does auth work?",', color: 'text-green-400' },
  { code: '  generateDiagram: true,', color: 'text-green-400' },
  { code: '})', color: 'text-slate-300' },
  { code: '', color: '' },
  { code: '// 🏛 Architecture:', color: 'text-slate-500' },
  { code: '// ┌── JWT Auth ──────────────┐', color: 'text-slate-400' },
  { code: '// │  Access Token (15m)      │', color: 'text-slate-400' },
  { code: '// │  Refresh Token (30d)     │', color: 'text-slate-400' },
  { code: '// └──────────────────────────┘', color: 'text-slate-400' },
]

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const { login, loginWithGithub } = useAuthStore()
  const router = useRouter()

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email address'
    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 6) newErrors.password = 'Password must be at least 6 characters'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
      router.push('/dashboard')
    } catch {
      toast.error('Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Left side — decorative */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-950">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-[400px] h-[400px] bg-brand-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-20 right-10 w-[300px] h-[300px] bg-violet-500/8 rounded-full blur-[80px]" />
          <div className="absolute inset-0 bg-dot-pattern opacity-40" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group w-fit">
            <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center shadow-glow">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">
              Code<span className="gradient-text">Forge</span> <span className="text-slate-400 font-normal">AI</span>
            </span>
          </Link>

          {/* Feature highlights */}
          <div className="space-y-6">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-4xl font-black text-white leading-tight"
            >
              Your autonomous<br />
              <span className="gradient-text">AI engineer</span>
              <br />awaits.
            </motion.h2>

            {[
              { icon: <Zap className="w-4 h-4" />, text: 'Real-time streaming responses' },
              { icon: <Code2 className="w-4 h-4" />, text: 'AST-aware code understanding' },
              { icon: <Shield className="w-4 h-4" />, text: 'Enterprise-grade security' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3 text-slate-300"
              >
                <div className="w-8 h-8 rounded-lg bg-brand-500/15 border border-brand-500/25 flex items-center justify-center text-brand-400">
                  {item.icon}
                </div>
                <span className="text-sm">{item.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Animated code card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="code-block rounded-2xl overflow-hidden shadow-glow border border-brand-500/20"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-900/80 border-b border-white/[0.05]">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs text-slate-500 font-mono">agent-demo.ts</span>
            </div>
            <div className="p-4">
              {codeLines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 + i * 0.07 }}
                  className={`font-mono text-xs leading-5 ${line.color}`}
                >
                  {line.code || '\u00A0'}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12 relative">
        <div className="absolute inset-0 bg-surface-950/50" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative w-full max-w-md space-y-8"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-xl text-white">CodeForge <span className="gradient-text">AI</span></span>
            </Link>
          </div>

          {/* Header */}
          <div>
            <h1 className="text-3xl font-black text-white">Welcome back</h1>
            <p className="mt-2 text-slate-400">Sign in to your account to continue</p>
          </div>

          {/* GitHub OAuth */}
          <Button
            variant="glass"
            size="lg"
            className="w-full gap-3 hover:border-white/20"
            onClick={loginWithGithub}
          >
            <Github className="w-5 h-5" />
            Continue with GitHub
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-500">
              <span className="px-3 bg-surface-950">or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="w-4 h-4" />}
                error={errors.email}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={errors.password}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full shadow-glow gap-2"
              isLoading={isLoading}
            >
              Sign In
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Register link */}
          <p className="text-center text-sm text-slate-400">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Create one free <Sparkles className="inline w-3 h-3" />
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
