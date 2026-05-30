'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import {
  Bot, Zap, Shield, GitBranch, TestTube, BookOpen, ArrowRight,
  Star, Github, ChevronRight, Code2, Network, Brain, Sparkles,
  BarChart3, FileCode2, Cpu, CheckCircle2, Menu, X
} from 'lucide-react'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'

const codeSnippet = `// CodeForge AI analyzing your repository...

const agent = new ArchitectAgent({
  model: 'gpt-4o',
  repository: 'my-saas-app',
  context: await ragEngine.retrieve(query),
})

const analysis = await agent.analyze({
  generateDiagram: true,
  detectPatterns: true,
  analyzeSecurity: true,
})

// Generated architecture diagram:
// ┌─────────────────────────────┐
// │     Next.js Frontend        │
// │  ┌──────┐  ┌────────────┐  │
// │  │ Auth │  │  Dashboard │  │
// └──┴──────┴──┴────────────┴──┘
//           ↓ REST + WS
// ┌─────────────────────────────┐
// │    FastAPI Backend (8 AI)   │
// │  🏛 Architect  💡 Understand │
// │  ⚙️  Feature   🔒 Security   │
// └─────────────────────────────┘`

const features = [
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'Multi-Agent AI System',
    description: '8 specialist AI agents work together — from architecture analysis to security scanning, each expert at its domain.',
    color: 'from-violet-500/20 to-purple-500/10',
    borderColor: 'border-violet-500/20',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/15',
  },
  {
    icon: <Network className="w-6 h-6" />,
    title: 'AST-Aware RAG Engine',
    description: 'Code intelligence that understands syntax trees, not just text. Retrieve the most relevant code chunks with surgical precision.',
    color: 'from-brand-500/20 to-indigo-500/10',
    borderColor: 'border-brand-500/20',
    iconColor: 'text-brand-400',
    iconBg: 'bg-brand-500/15',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Architecture Diagrams',
    description: 'Automatically generate Mermaid architecture diagrams for any codebase. Understand complex systems at a glance.',
    color: 'from-cyan-500/20 to-sky-500/10',
    borderColor: 'border-cyan-500/20',
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Security Scanning',
    description: 'Detect vulnerabilities, SQL injection, XSS, OWASP Top 10 issues, and hardcoded secrets across your entire codebase.',
    color: 'from-red-500/20 to-rose-500/10',
    borderColor: 'border-red-500/20',
    iconColor: 'text-red-400',
    iconBg: 'bg-red-500/15',
  },
  {
    icon: <TestTube className="w-6 h-6" />,
    title: 'Auto Test Generation',
    description: 'Generate comprehensive unit and integration tests with proper mocking. Coverage-aware test suite generation.',
    color: 'from-emerald-500/20 to-green-500/10',
    borderColor: 'border-emerald-500/20',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
  },
  {
    icon: <GitBranch className="w-6 h-6" />,
    title: 'Smart PR Reviews',
    description: 'Context-aware code review that understands your codebase conventions, detects anti-patterns, and suggests improvements.',
    color: 'from-amber-500/20 to-yellow-500/10',
    borderColor: 'border-amber-500/20',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
  },
]

const steps = [
  {
    step: '01',
    title: 'Connect Your Repository',
    description: 'Paste your GitHub URL and CodeForge AI will index your entire codebase — AST parsing, chunking, and embedding in minutes.',
    icon: <Github className="w-5 h-5" />,
  },
  {
    step: '02',
    title: 'Choose Your Agent',
    description: 'Select from 8 specialist agents: Architect, Understand, Feature, Review, Tests, Security, Docs, or Memory.',
    icon: <Bot className="w-5 h-5" />,
  },
  {
    step: '03',
    title: 'Get Instant Results',
    description: 'Watch as your AI engineer streams real-time responses with code diffs, diagrams, and source citations.',
    icon: <Zap className="w-5 h-5" />,
  },
]

const stats = [
  { value: '100K+', label: 'Lines Analyzed', icon: <Code2 className="w-5 h-5" /> },
  { value: '8', label: 'Specialist Agents', icon: <Bot className="w-5 h-5" /> },
  { value: '<2s', label: 'First Token Latency', icon: <Zap className="w-5 h-5" /> },
  { value: '99.9%', label: 'Uptime SLA', icon: <CheckCircle2 className="w-5 h-5" /> },
]

const techStack = [
  'GPT-4o', 'Claude 3.5', 'LangChain', 'Qdrant', 'FastAPI', 'Next.js 14', 'PostgreSQL', 'Redis'
]

const agents = [
  { emoji: '🏛', label: 'Architect' },
  { emoji: '💡', label: 'Understand' },
  { emoji: '⚙️', label: 'Feature' },
  { emoji: '🔍', label: 'Review' },
  { emoji: '🧪', label: 'Tests' },
  { emoji: '🔒', label: 'Security' },
  { emoji: '📚', label: 'Docs' },
  { emoji: '💾', label: 'Memory' },
]

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -60])

  return (
    <div className="min-h-screen bg-surface-950 overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/8 rounded-full blur-[120px]" />
        <div className="absolute top-60 right-0 w-[500px] h-[500px] bg-violet-500/6 rounded-full blur-[100px]" />
        <div className="absolute bottom-40 left-0 w-[600px] h-[400px] bg-cyan-500/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.4]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 z-50 glass border-b border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-brand-gradient rounded-lg opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Cpu className="w-4.5 h-4.5 text-white" />
                </div>
                <div className="absolute inset-0 bg-brand-gradient rounded-lg animate-pulse-glow opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="font-bold text-lg text-white">
                Code<span className="gradient-text">Forge</span>{' '}
                <span className="text-slate-400 font-normal">AI</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {['Features', 'Demo', 'Pricing', 'Docs'].map((item) => (
                <Link
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-white/5"
                >
                  {item}
                </Link>
              ))}
              <Link
                href="https://github.com"
                target="_blank"
                className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 transition-colors rounded-lg hover:bg-white/5 flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                GitHub
              </Link>
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="shadow-glow">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden glass-strong border-t border-white/[0.05] px-4 py-4 space-y-2"
          >
            {['Features', 'Demo', 'Pricing', 'GitHub'].map((item) => (
              <Link
                key={item}
                href={`#${item.toLowerCase()}`}
                className="block px-3 py-2 text-sm text-slate-300 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item}
              </Link>
            ))}
            <div className="flex gap-2 pt-2">
              <Link href="/login" className="flex-1">
                <Button variant="outline" size="sm" className="w-full">Sign In</Button>
              </Link>
              <Link href="/register" className="flex-1">
                <Button size="sm" className="w-full">Get Started</Button>
              </Link>
            </div>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left content */}
            <div className="space-y-8">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-4 py-1.5 text-sm">
                  <Sparkles className="w-3.5 h-3.5 text-brand-400 animate-pulse" />
                  <span className="text-brand-300 font-medium">Now with GPT-4o + Claude 3.5 Sonnet</span>
                  <ChevronRight className="w-3.5 h-3.5 text-brand-400" />
                </div>
              </motion.div>

              {/* Headline */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="space-y-3"
              >
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight">
                  <span className="text-white">Your AI</span>
                  <br />
                  <span className="gradient-text-animated">Software</span>
                  <br />
                  <span className="text-white">Engineer</span>
                </h1>
                <p className="text-xl text-slate-400 leading-relaxed max-w-xl">
                  8 specialist AI agents that understand your codebase deeply. Analyze architecture, generate features, review PRs, and scan for vulnerabilities — all in real-time.
                </p>
              </motion.div>

              {/* Agent pills */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="flex flex-wrap gap-2"
              >
                {agents.map((agent, i) => (
                  <motion.div
                    key={agent.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 hover:border-brand-500/30 hover:bg-brand-500/10 hover:text-brand-300 transition-all duration-200 cursor-default"
                  >
                    <span>{agent.emoji}</span>
                    {agent.label}
                  </motion.div>
                ))}
              </motion.div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-4"
              >
                <Link href="/register">
                  <Button size="lg" className="shadow-glow-lg animate-pulse-glow gap-2">
                    <Zap className="w-5 h-5" />
                    Get Started Free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="#demo">
                  <Button variant="glass" size="lg" className="gap-2">
                    <FileCode2 className="w-5 h-5" />
                    View Demo
                  </Button>
                </Link>
              </motion.div>

              {/* Social proof */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center gap-4 text-sm text-slate-500"
              >
                <div className="flex items-center gap-1">
                  <div className="flex -space-x-2">
                    {['A', 'B', 'C', 'D'].map((l, i) => (
                      <div
                        key={i}
                        className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-bold border-2 border-surface-950"
                      >
                        {l}
                      </div>
                    ))}
                  </div>
                  <span className="ml-1">2,400+ developers</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>4.9/5 rating</span>
                </div>
              </motion.div>
            </div>

            {/* Right: Code editor */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              {/* Glow behind editor */}
              <div className="absolute -inset-4 bg-brand-500/10 rounded-2xl blur-2xl" />

              <div className="relative code-block rounded-2xl overflow-hidden shadow-glow border border-brand-500/20">
                {/* Editor header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-surface-900/80 border-b border-white/[0.06]">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs text-slate-500 font-mono">codeforge-analysis.ts</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-emerald-400">AI Active</span>
                  </div>
                </div>
                {/* Code content */}
                <div className="p-5 overflow-x-auto">
                  <pre className="font-mono text-sm leading-relaxed text-slate-300 whitespace-pre">
                    <code>{codeSnippet}</code>
                  </pre>
                </div>
                {/* Streaming cursor */}
                <div className="px-5 pb-4 flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-brand-400 font-mono">Generating architecture diagram...</span>
                </div>
              </div>

              {/* Floating agent card */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute -bottom-6 -left-6 glass rounded-xl p-3 border border-white/[0.08] shadow-glass"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-lg">
                    🏛
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Architect Agent</div>
                    <div className="text-xs text-emerald-400 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Running
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating security card */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute -top-4 -right-4 glass rounded-xl p-3 border border-white/[0.08] shadow-glass"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">0 Vulnerabilities</div>
                    <div className="text-xs text-slate-400">Security scan passed</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Stats section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass rounded-2xl p-6 text-center border border-white/[0.06] hover:border-brand-500/20 transition-colors group"
              >
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center text-brand-400 group-hover:bg-brand-500/25 transition-colors">
                    {stat.icon}
                  </div>
                </div>
                <div className="text-3xl font-black gradient-text mb-1">{stat.value}</div>
                <div className="text-sm text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features section */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-1.5 text-sm text-cyan-400 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Features
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Everything your team needs
            </h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              A complete AI engineering platform that understands your codebase as deeply as your best developer.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className={`relative glass rounded-2xl p-6 border ${feature.borderColor} group overflow-hidden gradient-border`}
              >
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />

                <div className="relative">
                  <div className={`w-12 h-12 rounded-xl ${feature.iconBg} border ${feature.borderColor} flex items-center justify-center ${feature.iconColor} mb-4`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="demo" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-4 py-1.5 text-sm text-violet-400 mb-4">
              <Bot className="w-3.5 h-3.5" />
              How it works
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
              Get started in minutes
            </h2>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative"
              >
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-brand-500/30 to-transparent z-0" />
                )}
                <div className="relative glass rounded-2xl p-8 border border-white/[0.06] hover:border-brand-500/20 transition-colors">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="text-5xl font-black gradient-text leading-none">{step.step}</div>
                    <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center text-brand-400">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <p className="text-slate-500 text-sm uppercase tracking-wider font-medium">Powered by industry-leading AI infrastructure</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-wrap justify-center gap-3"
          >
            {techStack.map((tech, i) => (
              <motion.div
                key={tech}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl px-5 py-2.5 text-sm font-medium text-slate-300 border border-white/[0.06] hover:border-brand-500/30 hover:text-brand-300 transition-all duration-200 cursor-default"
              >
                {tech}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative glass-strong rounded-3xl p-12 text-center border border-white/[0.08] overflow-hidden"
          >
            <div className="absolute inset-0 bg-brand-gradient-subtle" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-brand-500/15 rounded-full blur-[60px]" />

            <div className="relative">
              <div className="text-5xl mb-6">🚀</div>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">
                Ready to supercharge<br />
                <span className="gradient-text">your engineering?</span>
              </h2>
              <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
                Join thousands of developers using CodeForge AI to understand, build, and secure their codebases faster.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/register">
                  <Button size="xl" className="shadow-glow-lg gap-2">
                    <Zap className="w-5 h-5" />
                    Start for Free
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="https://github.com" target="_blank">
                  <Button variant="glass" size="xl" className="gap-2">
                    <Github className="w-5 h-5" />
                    View on GitHub
                    <Star className="w-4 h-4 text-amber-400" />
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-brand-gradient rounded-lg flex items-center justify-center">
              <Cpu className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">CodeForge <span className="gradient-text">AI</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            {['Privacy', 'Terms', 'Docs', 'Blog', 'Contact'].map((item) => (
              <Link key={item} href="#" className="hover:text-slate-300 transition-colors">
                {item}
              </Link>
            ))}
          </div>
          <div className="text-sm text-slate-600">
            © 2025 CodeForge AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
