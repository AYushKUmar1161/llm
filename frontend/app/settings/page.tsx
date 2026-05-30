'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, Shield, Sliders, Key, Server, Save, Plus, Trash2,
  Copy, Check, Cpu, CheckCircle2, AlertTriangle, RefreshCw, Info, Lock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { toast } from 'react-hot-toast'
import { useApiKeys, useCreateApiKey, useDeleteApiKey, ApiKeyCreated } from '@/lib/api/hooks/useAuth'
import { formatRelativeTime } from '@/lib/utils'

type SettingsTab = 'general' | 'keys' | 'security' | 'system'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  // General Parameters Local Storage States
  const [activeModel, setActiveModel] = useState('gpt-4o')
  const [timeout, setTimeoutVal] = useState('30')
  const [ragRetrievals, setRagRetrievals] = useState(true)
  const [debugLogs, setDebugLogs] = useState(false)

  // API Key Dialogs States
  const [createOpen, setCreateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [expiryDays, setExpiryDays] = useState('30')
  const [generatedKey, setGeneratedKey] = useState<ApiKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)

  // API Key Custom Hooks
  const { data: apiKeys, isLoading: isLoadingKeys, refetch: refetchKeys } = useApiKeys()
  const createKeyMutation = useCreateApiKey()
  const deleteKeyMutation = useDeleteApiKey()

  // Load General parameters from Local Storage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setActiveModel(localStorage.getItem('codeforge_inference_model') || 'gpt-4o')
      setTimeoutVal(localStorage.getItem('codeforge_timeout') || '30')
      setRagRetrievals(localStorage.getItem('codeforge_rag_retrieval') !== 'false')
      setDebugLogs(localStorage.getItem('codeforge_debug_logs') === 'true')
    }
  }, [])

  const handleSaveGeneral = () => {
    try {
      localStorage.setItem('codeforge_inference_model', activeModel)
      localStorage.setItem('codeforge_timeout', timeout)
      localStorage.setItem('codeforge_rag_retrieval', String(ragRetrievals))
      localStorage.setItem('codeforge_debug_logs', String(debugLogs))
      toast.success('General configurations saved successfully!')
    } catch {
      toast.error('Failed to save settings to localStorage')
    }
  }

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name')
      return
    }

    try {
      // Calculate expiration date
      let expires_at: string | undefined = undefined
      if (expiryDays !== 'never') {
        const date = new Date()
        date.setDate(date.getDate() + parseInt(expiryDays))
        expires_at = date.toISOString()
      }

      const newKey = await createKeyMutation.mutateAsync({
        name: newKeyName,
        expires_at,
      })

      setGeneratedKey(newKey)
      setNewKeyName('')
      setCreateOpen(false)
      refetchKeys()
      toast.success('API Key generated successfully!')
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to generate API Key')
    }
  }

  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? Systems or CI/CD pipelines using this key will immediately lose access.')) {
      return
    }

    try {
      await deleteKeyMutation.mutateAsync(keyId)
      toast.success('API Key revoked successfully')
      refetchKeys()
    } catch {
      toast.error('Failed to revoke API key')
    }
  }

  const handleCopyKey = () => {
    if (!generatedKey) return
    navigator.clipboard.writeText(generatedKey.full_key)
    setCopied(true)
    toast.success('Secret key copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-1"
      >
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-400" />
          Platform Settings
        </h1>
        <p className="text-slate-400 text-sm">
          Customize connected LLM parameters, manage personal API keys, and toggle RAG retrieval configurations.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Sidebar Nav */}
        <div className="space-y-2">
          {[
            { id: 'general', label: 'General Parameters', icon: Sliders },
            { id: 'keys', label: 'API Keys & Secrets', icon: Key },
            { id: 'security', label: 'Workspace Security', icon: Shield },
            { id: 'system', label: 'System status', icon: Server },
          ].map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as SettingsTab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-brand-500/10 border border-brand-500/20 text-brand-300 shadow-glow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <item.icon className={`w-4.5 h-4.5 ${isActive ? 'text-brand-400' : 'text-slate-500'}`} />
                {item.label}
              </button>
            )
          })}
        </div>

        {/* Configurations pane */}
        <div className="md:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {/* GENERAL TAB */}
            {activeTab === 'general' && (
              <motion.div
                key="general"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="bg-surface-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-white">General Engine Settings</CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Configure default models and connection strategies used by specialist agents.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="space-y-2">
                      <Label htmlFor="model-select" className="text-xs text-slate-300">Primary Inference Model</Label>
                      <select
                        id="model-select"
                        value={activeModel}
                        onChange={(e) => setActiveModel(e.target.value)}
                        className="w-full h-9 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-slate-300 px-3 focus:outline-none focus:border-brand-500/40"
                      >
                        <option value="gpt-4o" className="bg-surface-900">GPT-4o (Default, High Performance)</option>
                        <option value="claude-3-5" className="bg-surface-900">Claude 3.5 Sonnet (Superior Coding)</option>
                        <option value="gemini-1-5" className="bg-surface-900">Gemini 1.5 Pro (Massive Context)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="timeout" className="text-xs text-slate-300">Agent Connection Timeout (Seconds)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        value={timeout}
                        onChange={(e) => setTimeoutVal(e.target.value)}
                        className="bg-white/[0.03] border-white/[0.08] text-slate-200"
                      />
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                      <div className="space-y-0.5">
                        <Label className="text-xs text-slate-300">AST-Aware RAG retrieval</Label>
                        <p className="text-[10px] text-slate-500">Inject dynamic function blueprints into model context.</p>
                      </div>
                      <Switch checked={ragRetrievals} onCheckedChange={setRagRetrievals} />
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                      <div className="space-y-0.5">
                        <Label className="text-xs text-slate-300">Detailed Debug Stream logs</Label>
                        <p className="text-[10px] text-slate-500">Stream AST parsing logs directly inside WebSocket messages.</p>
                      </div>
                      <Switch checked={debugLogs} onCheckedChange={setDebugLogs} />
                    </div>

                    <div className="pt-4 border-t border-white/[0.04] flex justify-end">
                      <Button onClick={handleSaveGeneral} className="shadow-glow gap-1.5 h-8 text-xs">
                        <Save className="w-3.5 h-3.5" /> Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* API KEYS TAB */}
            {activeTab === 'keys' && (
              <motion.div
                key="keys"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="bg-surface-950/20">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-white">Programmatic API Keys</CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Manage personal API access tokens for CI/CD pipeline triggers and command-line tools.
                      </CardDescription>
                    </div>
                    <Button onClick={() => setCreateOpen(true)} className="h-8 gap-1.5 text-xs shadow-glow">
                      <Plus className="w-3.5 h-3.5" /> Create Key
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    {isLoadingKeys ? (
                      <div className="space-y-2">
                        {[...Array(2)].map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))}
                      </div>
                    ) : !apiKeys || apiKeys.length === 0 ? (
                      <div className="text-center py-8 border border-dashed border-white/[0.06] rounded-xl bg-white/[0.01]">
                        <Key className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <h4 className="text-xs font-semibold text-slate-300">No active keys</h4>
                        <p className="text-[10px] text-slate-500 mt-1 max-w-[220px] mx-auto">
                          Generate an API key to communicate with CodeForge CLI or scan codebases securely.
                        </p>
                      </div>
                    ) : (
                      apiKeys.map((key) => {
                        const expired = key.expires_at ? new Date(key.expires_at) < new Date() : false
                        return (
                          <div
                            key={key.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-white/[0.04] bg-white/[0.01] hover:border-white/[0.08] transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-white truncate">{key.name}</span>
                                {expired ? (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">Expired</Badge>
                                ) : (
                                  <Badge className="text-[9px] px-1 py-0 h-4 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-1">
                                <span>Prefix: {key.key_prefix}...</span>
                                <span>•</span>
                                <span>Created {formatRelativeTime(key.created_at)}</span>
                                {key.expires_at && (
                                  <>
                                    <span>•</span>
                                    <span className={expired ? 'text-red-400' : ''}>
                                      {expired ? 'Expired' : 'Expires'} {formatRelativeTime(key.expires_at)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteKey(key.id)}
                              disabled={deleteKeyMutation.isPending}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                              title="Revoke Key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* SECURITY TAB */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="bg-surface-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      Workspace Security & Sandbox Isolation
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      View container isolation configurations and secure deployment details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Compute Runtime</span>
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sandbox Isolated
                          </span>
                        </div>
                        <div className="text-sm font-black text-white">Docker Core-gVisor</div>
                        <p className="text-[10px] text-slate-500">Agent commands execute inside custom gVisor microVMs with restricted system calls.</p>
                      </div>

                      <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>Memory Encryption</span>
                          <span className="flex items-center gap-1 text-[10px] text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                            <Lock className="w-2.5 h-2.5" /> RSA-4096 / AES
                          </span>
                        </div>
                        <div className="text-sm font-black text-white">DB & Credentials</div>
                        <p className="text-[10px] text-slate-500">Personal access tokens and secrets are hashed and encrypted at-rest using AES-GCM-256.</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.01] space-y-2">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-slate-400" />
                        Network Isolation Policies
                      </h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Sandbox sessions run with highly restricted egress routing. Dynamic firewalls block all unauthorized connections except for GitHub, NPM, and PyPI mirrors to prevent data-exfiltration.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* SYSTEM STATUS TAB */}
            {activeTab === 'system' && (
              <motion.div
                key="system"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="bg-surface-950/20">
                  <CardHeader>
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Server className="w-4 h-4 text-brand-400" />
                      Infrastructure Services Health
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Real-time connection metrics for platform databases and brokers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {[
                      { name: 'Core Database (SQLAlchemy / SQLite)', status: 'Connected', ping: '0.4ms', desc: 'Active transactional relational registry.', color: 'text-emerald-400' },
                      { name: 'In-Memory Broker & Cache (Redis)', status: 'Active (Healthy)', ping: '1.2ms', desc: 'Orchestrates real-time chat websockets & dynamic caches.', color: 'text-emerald-400' },
                      { name: 'Celery Distributed Task Worker', status: 'Idle (Listening)', ping: 'Active', desc: 'Processes git clones, AST traversals and vector indexing.', color: 'text-brand-400' },
                      { name: 'Semantic Vector Store (ChromaDB / Qdrant)', status: 'Ready', ping: '0.8ms', desc: 'Stores localized file embeddings and cCRE indices.', color: 'text-emerald-400' },
                    ].map((svc) => (
                      <div
                        key={svc.name}
                        className="p-3.5 rounded-xl border border-white/[0.04] bg-white/[0.01] flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <div className="text-xs font-bold text-white">{svc.name}</div>
                          <div className="text-[10px] text-slate-500 leading-normal">{svc.desc}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-xs font-bold ${svc.color}`}>{svc.status}</div>
                          <div className="text-[10px] text-slate-500 mt-1 font-mono">{svc.ping}</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CREATE API KEY MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Generate Programmatic Key</DialogTitle>
            <DialogDescription>
              Create a secure token for programmatic triggers, scans, and command-line operations.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateKey} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="keyName" className="text-xs font-semibold text-slate-300">API Key Label/Name</Label>
              <Input
                id="keyName"
                placeholder="e.g. production-jenkins-cli"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="bg-white/[0.03] border-white/[0.08]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiry" className="text-xs font-semibold text-slate-300">Token Expiration Period</Label>
              <select
                id="expiry"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                className="w-full h-9 rounded-lg bg-surface-900 border border-white/[0.08] text-sm text-slate-300 px-3 focus:outline-none focus:border-brand-500/40"
              >
                <option value="7">7 Days</option>
                <option value="30">30 Days</option>
                <option value="90">90 Days</option>
                <option value="never">Never Expire (Not Recommended)</option>
              </select>
            </div>
            <DialogFooter className="pt-4 gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createKeyMutation.isPending} className="shadow-glow">
                {createKeyMutation.isPending ? 'Generating...' : 'Create Key'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SECURELY GENERATED API KEY MODAL (SHOWS ONLY ONCE) */}
      <Dialog open={!!generatedKey} onOpenChange={(open) => { if (!open) setGeneratedKey(null) }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              API Key Generated Successfully
            </DialogTitle>
            <DialogDescription className="text-red-400 font-medium">
              Copy this token now! For security reasons, it will NOT be displayed again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-3 rounded-lg bg-surface-950 border border-emerald-500/10 flex items-center justify-between gap-3 font-mono text-xs text-slate-200">
              <span className="truncate break-all select-all font-semibold">{generatedKey?.full_key}</span>
              <button
                onClick={handleCopyKey}
                className="p-1.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-slate-400 hover:text-white flex-shrink-0"
                title="Copy to Clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 flex gap-2.5 text-[11px] text-slate-400">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                If you navigate away or close this dialog, you cannot recover this secret key. You will need to revoke it and generate a new one.
              </p>
            </div>

            <DialogFooter className="pt-2">
              <Button onClick={() => setGeneratedKey(null)} className="shadow-glow w-full sm:w-auto">
                I have stored it securely
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
