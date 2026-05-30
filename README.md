<div align="center">

# ⚡ CodeForge AI

### Autonomous Software Engineer & Repository Intelligence Platform

[![CI](https://github.com/your-org/codeforge-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/codeforge-ai/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-0.2-blueviolet.svg)](https://langchain-ai.github.io/langgraph/)

**An AI system that behaves like a Staff Software Engineer — understanding, analyzing, improving, and extending large codebases.**

[Demo](#) · [Documentation](#architecture) · [Quick Start](#quick-start) · [Contributing](#contributing)

</div>

---

## 🎯 What is CodeForge AI?

CodeForge AI is a **production-grade, multi-agent AI platform** that goes far beyond a typical chatbot or RAG demo. It uses a sophisticated multi-agent architecture powered by LangGraph to act as an autonomous software engineer capable of:

- 🏛️ **Understanding** codebases with 100,000+ lines of code
- ⚙️ **Generating** new features with full implementation plans, code, migrations, and tests
- 🔍 **Reviewing** pull requests with security, performance, and complexity analysis
- 🧪 **Creating** comprehensive test suites (unit, integration, edge cases)
- 🔒 **Scanning** for security vulnerabilities (secrets, SQLi, XSS, CVEs)
- 📚 **Generating** documentation (README, API docs, architecture guides)
- 🗺️ **Visualizing** repository architecture as interactive Mermaid diagrams
- 💾 **Maintaining** cross-session project memory

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js Frontend                              │
│   Chat Interface │ Architecture Visualizer │ Analytics Dashboard │
└──────────────────────────┬──────────────────────────────────────┘
                           │ WebSocket + REST
┌──────────────────────────▼──────────────────────────────────────┐
│                    FastAPI Backend                               │
│          Auth │ WebSocket │ REST API │ Rate Limiting             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│               Multi-Agent Layer (LangGraph)                      │
│  ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐            │
│  │Repo      │ │Code     │ │Feature  │ │PR Review │            │
│  │Architect │ │Understand│ │Engineer │ │  Agent   │            │
│  └──────────┘ └─────────┘ └─────────┘ └──────────┘            │
│  ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐            │
│  │Test      │ │Security │ │Doc      │ │Memory    │            │
│  │Engineer  │ │  Agent  │ │Generator│ │  Agent   │            │
│  └──────────┘ └─────────┘ └─────────┘ └──────────┘            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│            Repository Intelligence Engine                        │
│   AST Parser │ Smart Chunker │ Hybrid Retrieval │ Re-ranker     │
└──────┬───────────────────────────────────────┬───────────────────┘
       │                                       │
┌──────▼──────┐  ┌──────────────┐  ┌──────────▼──────┐
│ PostgreSQL  │  │    Redis     │  │    ChromaDB     │
│  (metadata) │  │(cache/queue) │  │  (vectors)      │
└─────────────┘  └──────────────┘  └─────────────────┘
```

## 🤖 The 8 Specialist Agents

| Agent | Trigger | Output |
|-------|---------|--------|
| 🏛️ **Repository Architect** | "Analyze this codebase" | Architecture report, dependency graph, Mermaid diagram |
| 🧠 **Code Understanding** | "Explain this function/class/file" | Plain-English explanation, design pattern detection |
| ⚙️ **Feature Engineer** | "Add JWT authentication" | Impacted files, implementation plan, code, tests, diff |
| 🔍 **PR Reviewer** | "Review this PR" | Security issues, complexity score, risk level (0-100) |
| 🧪 **Test Engineer** | "Generate tests for this" | pytest/jest test suite, edge cases, coverage estimate |
| 🔒 **Security Agent** | "Scan for vulnerabilities" | Secrets, SQLi, XSS, CVEs with severity scores |
| 📚 **Doc Generator** | "Generate documentation" | README, API docs, architecture docs, onboarding guide |
| 💾 **Memory Agent** | Automatic | Cross-session context, history compression |

## 🚀 Quick Start

### Prerequisites

- Docker Desktop installed and running
- Git
- At least one LLM API key (OpenAI, Gemini, or Anthropic)

### 1. Clone and Configure

```bash
git clone https://github.com/your-org/codeforge-ai.git
cd codeforge-ai

# Copy environment template
cp .env.example .env

# Edit .env with your API keys (minimum: OPENAI_API_KEY)
```

### 2. Configure `.env`

```bash
# Required: At least one LLM provider
OPENAI_API_KEY=sk-your-key-here

# Required for GitHub integration
GITHUB_CLIENT_ID=your-github-oauth-app-id
GITHUB_CLIENT_SECRET=your-github-oauth-app-secret

# Optional: Enhanced observability
LANGCHAIN_API_KEY=your-langsmith-key
```

### 3. Start All Services

```bash
docker-compose up -d
```

This starts:
- 🌐 **Frontend** → http://localhost:3000
- ⚡ **Backend API** → http://localhost:8000
- 📊 **API Docs** → http://localhost:8000/docs
- 🌸 **Celery Monitor** → http://localhost:5555
- 📈 **Grafana** → http://localhost:3001 (admin/codeforge_grafana)
- 📉 **Prometheus** → http://localhost:9090
- 🗃️ **ChromaDB** → http://localhost:8001

### 4. Initialize Database

```bash
docker-compose exec backend alembic upgrade head
```

### 5. Use It

1. Open http://localhost:3000
2. Register an account
3. Connect a GitHub repository
4. Wait for indexing to complete (progress shown in UI)
5. Start chatting!

**Example queries:**
- *"Give me an architecture overview of this codebase"*
- *"Add OAuth2 authentication with GitHub provider"*
- *"Scan this repo for security vulnerabilities"*
- *"Generate comprehensive tests for the auth module"*
- *"Review this code: `[paste code]`"*

## 📁 Project Structure

```
codeforge-ai/
├── frontend/                    # Next.js 14 (TypeScript, Tailwind, shadcn/ui)
│   ├── app/                     # App Router pages
│   ├── components/              # Reusable components
│   └── lib/                     # Stores, API hooks, utilities
│
├── backend/                     # FastAPI + LangGraph
│   ├── app/
│   │   ├── agents/              # 8 LangGraph specialist agents
│   │   ├── intelligence/        # AST parser, RAG pipeline, embedder
│   │   ├── github/              # GitHub integration
│   │   ├── api/v1/              # REST + WebSocket endpoints
│   │   ├── models/              # SQLAlchemy models
│   │   ├── tasks/               # Celery background tasks
│   │   └── core/                # Config, security, LLM factory
│   └── tests/
│
├── infrastructure/
│   ├── docker/                  # Dockerfiles
│   ├── k8s/                     # Kubernetes manifests + HPA
│   └── monitoring/              # Prometheus + Grafana configs
│
├── .github/workflows/           # CI/CD pipelines
├── docker-compose.yml
└── .env.example
```

## 🧠 What Makes This Different

### 1. AST-Aware Code Intelligence
Unlike naive text-splitting RAG, CodeForge AI parses the Abstract Syntax Tree of your code. It understands **functions, classes, methods, imports**, and creates semantically meaningful chunks that never break in the middle of a function.

### 2. Hybrid Retrieval (BM25 + Vector Search)
Combines dense vector search (semantic similarity) with BM25 sparse retrieval (keyword matching), then fuses results with Reciprocal Rank Fusion. This dramatically outperforms pure vector search for code.

### 3. Multi-Agent Orchestration with LangGraph
Each query is routed to the appropriate specialist agent. Agents can chain together (e.g., Feature Engineer → Test Engineer → Memory Agent). The state graph enables complex multi-step reasoning.

### 4. Real-time Streaming via WebSocket
All agent responses stream character-by-character via WebSocket. No waiting for the full response.

### 5. Cross-Session Memory
The Memory Agent maintains a persistent understanding of your repository across sessions — remembering previous analyses, generated code, and reviews.

## 🔑 GitHub OAuth Setup

1. Go to GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App
2. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
3. Copy Client ID and Client Secret to `.env`

## 🧪 Development

```bash
# Backend only (with hot reload)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend only
cd frontend && npm run dev

# Run backend tests
cd backend && pytest tests/ -v --cov=app

# Run Celery worker locally
cd backend && celery -A app.tasks.celery_app worker --loglevel=info
```

## 📊 Monitoring

- **LangSmith**: Set `LANGCHAIN_TRACING_V2=true` and `LANGCHAIN_API_KEY` to see full agent traces
- **Prometheus**: Metrics at `/metrics` endpoint
- **Grafana**: Pre-configured dashboards at http://localhost:3001
- **Flower**: Celery task monitor at http://localhost:5555

## 🚢 Production Deployment (Kubernetes)

```bash
# Apply all manifests
kubectl apply -f infrastructure/k8s/deployments/
kubectl apply -f infrastructure/k8s/services/

# Update secrets (edit before applying!)
kubectl apply -f infrastructure/k8s/deployments/deployments.yaml

# Check status
kubectl get pods -n codeforge
kubectl get hpa -n codeforge
```

## 🛡️ Security

- JWT authentication (access + refresh token rotation)
- API key support for programmatic access
- GitHub OAuth integration
- Role-based access control (admin/member/viewer)
- Rate limiting per user
- All secrets managed via environment variables / Kubernetes Secrets
- Trivy and Gitleaks scanning in CI pipeline

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-agent`)
3. Commit with conventional commits (`git commit -m 'feat: add amazing agent'`)
4. Push and open a Pull Request
5. The PR Review Agent will automatically review your code 😄

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

<div align="center">

Built with ❤️ using FastAPI, Next.js, LangGraph, and a lot of coffee.

**[⭐ Star this repo](https://github.com/your-org/codeforge-ai)** if CodeForge AI helped you!

</div>
