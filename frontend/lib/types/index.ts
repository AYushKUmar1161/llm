// All TypeScript interfaces for CodeForge AI

export interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  githubUsername?: string
  githubId?: string
  plan: 'free' | 'pro' | 'enterprise'
  createdAt: string
  updatedAt: string
}

export interface Repository {
  id: string
  userId: string
  name: string
  fullName: string
  description?: string
  githubUrl: string
  defaultBranch: string
  language?: string
  languages?: Record<string, number>
  stars?: number
  forks?: number
  isPrivate: boolean
  indexStatus: 'pending' | 'indexing' | 'indexed' | 'ready' | 'failed'
  indexProgress?: number
  indexedAt?: string
  totalFiles?: number
  totalLines?: number
  techStack?: string[]
  createdAt: string
  updatedAt: string
}

export interface FileNode {
  name: string
  path: string
  type?: 'file' | 'directory'
  isDir?: boolean
  is_dir?: boolean
  children?: FileNode[]
  size?: number
  extension?: string
  language?: string
}

export interface Conversation {
  id: string
  userId: string
  repositoryId: string
  title: string
  agentType: AgentType
  messageCount: number
  tokensUsed: number
  createdAt: string
  updatedAt: string
  lastMessage?: string
}

export type AgentType =
  | 'architect'
  | 'understand'
  | 'feature'
  | 'review'
  | 'tests'
  | 'security'
  | 'docs'
  | 'memory'

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agentType?: AgentType
  sources?: SourceReference[]
  metadata?: MessageMetadata
  tokensUsed?: number
  createdAt: string
  isStreaming?: boolean
}

export interface SourceReference {
  id: string
  filePath: string
  startLine?: number
  endLine?: number
  snippet?: string
  relevanceScore?: number
  chunkType?: string
}

export interface MessageMetadata {
  hasDiff?: boolean
  diffContent?: string
  hasDiagram?: boolean
  diagramContent?: string
  hasTests?: boolean
  testContent?: string
  executionTime?: number
  agentSteps?: AgentStep[]
}

export interface AgentStep {
  step: string
  description: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration?: number
}

export interface AgentRun {
  id: string
  conversationId: string
  agentType: AgentType
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt: string
  completedAt?: string
  duration?: number
  tokensUsed?: number
  inputTokens?: number
  outputTokens?: number
  steps?: AgentStep[]
  error?: string
}

export interface ArchitectureReport {
  id: string
  repositoryId: string
  summary: string
  mermaidDiagram: string
  mermaid_diagram?: string
  components: ArchitectureComponent[]
  patterns: string[]
  techStack: TechStackItem[]
  entryPoints: string[]
  keyFiles: string[]
  generatedAt: string
}

export interface ArchitectureComponent {
  name: string
  type: string
  description: string
  files: string[]
  dependencies: string[]
}

export interface TechStackItem {
  name: string
  category: string
  version?: string
  confidence: number
}

export interface ReviewReport {
  id: string
  conversationId: string
  repositoryId: string
  summary: string
  overallScore: number
  issues: ReviewIssue[]
  suggestions: string[]
  generatedAt: string
}

export interface ReviewIssue {
  id: string
  type: 'bug' | 'performance' | 'style' | 'maintainability' | 'security'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  filePath: string
  line?: number
  description: string
  suggestion?: string
  codeSnippet?: string
}

export interface SecurityReport {
  id: string
  conversationId: string
  repositoryId: string
  summary: string
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe'
  vulnerabilities: SecurityVulnerability[]
  recommendations: string[]
  generatedAt: string
}

export interface SecurityVulnerability {
  id: string
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  cwe?: string
  cve?: string
  filePath: string
  line?: number
  description: string
  remediation?: string
  codeSnippet?: string
}

export interface TestSuite {
  id: string
  conversationId: string
  repositoryId: string
  filePath: string
  framework: string
  tests: GeneratedTest[]
  coverage?: number
  generatedAt: string
}

export interface GeneratedTest {
  name: string
  description: string
  code: string
  type: 'unit' | 'integration' | 'e2e'
}

export interface Analytics {
  totalRepositories: number
  totalConversations: number
  totalMessages: number
  totalTokensUsed: number
  totalAgentRuns: number
  conversationsToday: number
  tokensToday: number
  agentRunsToday: number
  tokenUsageOverTime: TokenUsageDataPoint[]
  agentTypeBreakdown: AgentTypeBreakdown[]
  recentActivity: ActivityItem[]
}

export interface TokenUsageDataPoint {
  date: string
  tokens: number
  cost: number
}

export interface AgentTypeBreakdown {
  agentType: AgentType
  count: number
  tokensUsed: number
}

export interface ActivityItem {
  id: string
  type: 'conversation' | 'agent_run' | 'repository_indexed' | 'security_scan'
  description: string
  repositoryName?: string
  agentType?: AgentType
  status?: string
  createdAt: string
}

export interface StreamChunk {
  type: 'token' | 'source' | 'metadata' | 'error' | 'done'
  content?: string
  sources?: SourceReference[]
  metadata?: MessageMetadata
  error?: string
}

export interface ConnectRepositoryRequest {
  githubUrl?: string
  github_url?: string
  branch?: string
  default_branch?: string
  isPrivate?: boolean
}

export interface SendMessageRequest {
  conversationId: string
  content: string
  agentType?: AgentType
}

export interface CreateConversationRequest {
  repositoryId: string
  title?: string
  agentType?: AgentType
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
  details?: Record<string, unknown>
}

export const AGENT_CONFIG: Record<AgentType, { label: string; emoji: string; color: string; description: string }> = {
  architect: {
    label: 'Architect',
    emoji: '🏛',
    color: 'from-violet-500 to-purple-600',
    description: 'Analyze system architecture and generate diagrams',
  },
  understand: {
    label: 'Understand',
    emoji: '💡',
    color: 'from-yellow-500 to-orange-500',
    description: 'Deep code understanding and explanation',
  },
  feature: {
    label: 'Feature',
    emoji: '⚙️',
    color: 'from-brand-500 to-indigo-600',
    description: 'Generate new features and implementations',
  },
  review: {
    label: 'Review',
    emoji: '🔍',
    color: 'from-sky-500 to-blue-600',
    description: 'Code review and quality analysis',
  },
  tests: {
    label: 'Tests',
    emoji: '🧪',
    color: 'from-emerald-500 to-green-600',
    description: 'Automated test generation',
  },
  security: {
    label: 'Security',
    emoji: '🔒',
    color: 'from-red-500 to-rose-600',
    description: 'Security vulnerability scanning',
  },
  docs: {
    label: 'Docs',
    emoji: '📚',
    color: 'from-cyan-500 to-teal-600',
    description: 'Documentation generation',
  },
  memory: {
    label: 'Memory',
    emoji: '💾',
    color: 'from-slate-500 to-zinc-600',
    description: 'Repository memory and context management',
  },
}
