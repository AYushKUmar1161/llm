'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Github, Cpu, Eye, EyeOff, Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/stores/authStore'
import apiClient from '@/lib/api/client'
import toast from 'react-hot-toast'

const perks = [
  'Connect unlimited repositories',
  'Access all 8 AI specialist agents',
  'Real-time streaming responses',
  'Architecture diagram generation',
  'Security vulnerability scanning',
  'Automated test generation',
]

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; email?: string; password?: string }>({})
  const { login, loginWithGithub } = useAuthStore()
  const router = useRouter()

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!email) newErrors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = 'Invalid email address'
    if (!password) newErrors.password = 'Password is required'
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      await apiClient.post('/auth/register', { name, email, password })
      await login(email, password)
      toast.success('Account created! Welcome to CodeForge AI 🚀')
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'Registration failed'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex">
      {/* Left side */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-surface-950">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-10 w-[400px] h-[400px] bg-violet-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-20 left-10 w-[300px] h-[300px] bg-brand-500/8 rounded-full blur-[80px]" />
          <div className="absolute inset-0 bg-dot-pattern opacity-40" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link href="/" className="flex items-center gap-2.5 w-fit">
            <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center shadow-glow">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl text-white">
              Code<span className="gradient-text">Forge</span> <span className="text-slate-400 font-normal">AI</span>
            </span>
          </Link>

          <div className="space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h2 className="text-4xl font-black text-white leading-tight mb-3">
                Everything you need<br />
                <span className="gradient-text">to ship faster.</span>
              </h2>
              <p className="text-slate-400">Join thousands of developers who trust CodeForge AI to understand and improve their codebases.</p>
            </motion.div>

            <div className="space-y-3">
              {perks.map((perk, i) => (
                <motion.div
                  key={perk}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-300">{perk}</span>
                </motion.div>
              ))}
            </div>

            {/* Testimonial */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="glass rounded-2xl p-5 border border-white/[0.06]"
            >
              <p className="text-sm text-slate-300 italic leading-relaxed mb-4">
                &ldquo;CodeForge AI understood our 200k LOC codebase in minutes. The architecture diagram it generated saved us weeks of documentation work.&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand-gradient flex items-center justify-center text-white text-sm font-bold">
                  SK
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">Sarah K.</div>
                  <div className="text-xs text-slate-500">CTO @ TechCorp</div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="text-xs text-slate-600">No credit card required. Free plan available.</div>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-7"
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

          <div>
            <h1 className="text-3xl font-black text-white">Create your account</h1>
            <p className="mt-2 text-slate-400">Start building with AI-powered code intelligence</p>
          </div>

          {/* GitHub OAuth */}
          <Button
            variant="glass"
            size="lg"
            className="w-full gap-3 hover:border-white/20"
            onClick={loginWithGithub}
          >
            <Github className="w-5 h-5" />
            Sign up with GitHub
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/[0.06]" />
            </div>
            <div className="relative flex justify-center text-xs text-slate-500">
              <span className="px-3 bg-surface-950">or register with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                error={errors.name}
                autoComplete="name"
              />
            </div>

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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-slate-300 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                error={errors.password}
              />
              {password.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        password.length > i * 2
                          ? password.length < 6 ? 'bg-red-500' : password.length < 10 ? 'bg-amber-500' : 'bg-emerald-500'
                          : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full shadow-glow gap-2"
              isLoading={isLoading}
            >
              Create Account
              <ArrowRight className="w-4 h-4" />
            </Button>

            <p className="text-xs text-slate-500 text-center">
              By creating an account, you agree to our{' '}
              <Link href="/terms" className="text-brand-400 hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-brand-400 hover:underline">Privacy Policy</Link>.
            </p>
          </form>

          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
