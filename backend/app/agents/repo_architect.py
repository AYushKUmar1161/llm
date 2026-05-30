from __future__ import annotations

import asyncio
import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import networkx as nx
from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory

logger = logging.getLogger(__name__)

_TECH_STACK_PATTERNS: Dict[str, Dict[str, List[str]]] = {
    "frameworks": {
        "FastAPI": ["fastapi", "uvicorn"],
        "Django": ["django"],
        "Flask": ["flask"],
        "Express": ["express", "expressjs"],
        "Next.js": ["next", "nextjs"],
        "React": ["react", "react-dom"],
        "Vue": ["vue"],
        "Angular": ["@angular/core"],
        "Spring Boot": ["spring-boot", "springframework"],
        "Laravel": ["laravel"],
    },
    "databases": {
        "PostgreSQL": ["psycopg2", "asyncpg", "postgresql"],
        "MySQL": ["mysql", "pymysql"],
        "MongoDB": ["pymongo", "mongoose"],
        "Redis": ["redis", "aioredis"],
        "SQLite": ["sqlite3"],
        "Elasticsearch": ["elasticsearch"],
    },
    "tools": {
        "Docker": ["dockerfile", "docker-compose"],
        "Kubernetes": ["kubernetes", "k8s", "helm"],
        "GitHub Actions": ["github/workflows"],
        "Celery": ["celery"],
        "Pytest": ["pytest"],
        "Jest": ["jest"],
        "Webpack": ["webpack"],
        "Vite": ["vite"],
    },
}


@dataclass
class ArchitectureReport:
    tech_stack: Dict[str, Any]
    dependency_graph: Dict[str, List[str]]
    file_structure: str
    main_components: List[str]
    design_patterns: List[str]
    mermaid_diagram: str
    architecture_summary: str
    summary: str


class RepoArchitectAgent:
    """
    Analyzes a repository's architecture: tech stack, dependency graph,
    and generates a Mermaid diagram + summary.
    """

    def analyze(
        self, repo_id: str, local_path: Optional[str] = None
    ) -> ArchitectureReport:
        from app.github.cloner import RepositoryCloner
        from app.core.config import settings

        if local_path is None:
            local_path = str(Path(settings.REPOS_BASE_PATH) / repo_id)

        cloner = RepositoryCloner()
        if not Path(local_path).exists():
            return ArchitectureReport(
                tech_stack={},
                dependency_graph={},
                file_structure="Repository not cloned.",
                main_components=[],
                design_patterns=[],
                mermaid_diagram="graph TD\n  A[Repository not cloned]",
                architecture_summary="Repository has not been cloned yet.",
                summary="Repository not available for analysis.",
            )

        files = cloner.list_files(local_path)
        tech_stack = self.detect_tech_stack(files, local_path, cloner)
        dep_graph = self.build_dependency_graph(local_path, files)
        file_structure = self._build_file_tree(files[:100])  # limit for display
        main_components = self._identify_components(files)
        design_patterns = self._detect_design_patterns_from_files(files)
        mermaid = self.generate_mermaid(dep_graph, main_components)
        arch_summary = self._generate_summary(tech_stack, main_components, design_patterns)

        return ArchitectureReport(
            tech_stack=tech_stack,
            dependency_graph=dep_graph,
            file_structure=file_structure,
            main_components=main_components,
            design_patterns=design_patterns,
            mermaid_diagram=mermaid,
            architecture_summary=arch_summary,
            summary=arch_summary,
        )

    def detect_tech_stack(
        self,
        files: List[str],
        local_path: str,
        cloner=None,
    ) -> Dict[str, Any]:
        from app.github.cloner import RepositoryCloner

        cloner = cloner or RepositoryCloner()
        tech: Dict[str, Dict[str, bool]] = {
            "frameworks": {},
            "databases": {},
            "tools": {},
            "languages": {},
        }

        # Detect languages from file extensions
        from collections import Counter
        ext_counts: Counter = Counter()
        for f in files:
            ext = Path(f).suffix.lower()
            if ext:
                ext_counts[ext] += 1

        _ext_lang = {
            ".py": "Python", ".js": "JavaScript", ".ts": "TypeScript",
            ".java": "Java", ".go": "Go", ".rs": "Rust", ".rb": "Ruby",
            ".php": "PHP", ".cs": "C#", ".cpp": "C++",
        }
        for ext, count in ext_counts.most_common(10):
            if ext in _ext_lang:
                tech["languages"][_ext_lang[ext]] = True

        # Check known manifest files for dependencies
        manifest_files = [
            "requirements.txt", "Pipfile", "pyproject.toml", "setup.py",
            "package.json", "pom.xml", "build.gradle", "Gemfile", "composer.json",
            "go.mod", "Cargo.toml",
        ]
        full_manifest_text = ""
        for mf in manifest_files:
            for f in files:
                if Path(f).name == mf:
                    content = cloner.read_file(local_path, f)
                    full_manifest_text += content.lower() + "\n"
                    break

        for category, patterns in _TECH_STACK_PATTERNS.items():
            for name, keywords in patterns.items():
                if any(kw.lower() in full_manifest_text for kw in keywords):
                    tech[category][name] = True

        # Check Dockerfile
        for f in files:
            if "dockerfile" in f.lower():
                tech["tools"]["Docker"] = True
            if ".github/workflows" in f.lower():
                tech["tools"]["GitHub Actions"] = True

        return tech

    def build_dependency_graph(
        self, local_path: str, files: List[str]
    ) -> Dict[str, List[str]]:
        from app.github.cloner import RepositoryCloner
        from app.intelligence.ast_parser import ASTParser

        cloner = RepositoryCloner()
        parser = ASTParser()
        graph: Dict[str, List[str]] = {}

        # Only process Python files for import graph (most reliable)
        python_files = [f for f in files if f.endswith(".py")][:50]

        for rel_path in python_files:
            content = cloner.read_file(local_path, rel_path)
            imports = parser.get_imports(content, "python")
            # Filter to local imports (relative or project-level)
            local_imports = [
                imp for imp in imports
                if not any(imp.startswith(std) for std in (
                    "os", "sys", "re", "json", "math", "datetime", "collections",
                    "typing", "pathlib", "logging", "abc", "functools", "itertools",
                    "asyncio", "threading", "subprocess", "hashlib", "uuid",
                ))
            ]
            module_key = rel_path.replace("/", ".").replace("\\", ".").removesuffix(".py")
            graph[module_key] = local_imports[:10]

        return graph

    def generate_mermaid(
        self,
        dep_graph: Dict[str, List[str]],
        components: Optional[List[str]] = None,
    ) -> str:
        lines = ["graph TD"]

        if components:
            # High-level component diagram
            for i, comp in enumerate(components[:10]):
                safe_name = re.sub(r"[^a-zA-Z0-9]", "_", comp)
                lines.append(f"  {safe_name}[\"{comp}\"]")

            # Add edges between components that share keywords
            for i, comp_a in enumerate(components[:10]):
                for j, comp_b in enumerate(components[:10]):
                    if i >= j:
                        continue
                    a_key = comp_a.lower().split("/")[-1]
                    b_key = comp_b.lower().split("/")[-1]
                    if a_key in b_key or b_key in a_key:
                        safe_a = re.sub(r"[^a-zA-Z0-9]", "_", comp_a)
                        safe_b = re.sub(r"[^a-zA-Z0-9]", "_", comp_b)
                        lines.append(f"  {safe_a} --> {safe_b}")
        elif dep_graph:
            # Module dependency diagram (truncated)
            for module, deps in list(dep_graph.items())[:15]:
                safe_mod = re.sub(r"[^a-zA-Z0-9]", "_", module.split(".")[-1])
                lines.append(f"  {safe_mod}[\"{module.split('.')[-1]}\"]")
                for dep in deps[:3]:
                    safe_dep = re.sub(r"[^a-zA-Z0-9]", "_", dep.split(".")[-1])
                    lines.append(f"  {safe_mod} --> {safe_dep}[\"{dep.split('.')[-1]}\"]")
        else:
            lines.append("  A[No dependency data available]")

        return "\n".join(lines)

    def _build_file_tree(self, files: List[str]) -> str:
        if not files:
            return "(empty)"
        tree_lines = []
        dirs_seen: set[str] = set()
        for f in sorted(files):
            parts = Path(f).parts
            for i, part in enumerate(parts[:-1]):
                parent = "/".join(str(p) for p in parts[:i+1])
                if parent not in dirs_seen:
                    dirs_seen.add(parent)
                    tree_lines.append("  " * i + f"📁 {part}/")
            tree_lines.append("  " * (len(parts) - 1) + f"📄 {parts[-1]}")
        return "\n".join(tree_lines[:200])

    def _identify_components(self, files: List[str]) -> List[str]:
        """Identify top-level directories as architectural components."""
        top_dirs: Dict[str, int] = {}
        for f in files:
            parts = Path(f).parts
            if len(parts) > 1:
                top_dir = parts[0]
                top_dirs[top_dir] = top_dirs.get(top_dir, 0) + 1

        # Sort by file count
        sorted_dirs = sorted(top_dirs.items(), key=lambda x: x[1], reverse=True)
        return [d for d, _ in sorted_dirs[:10]]

    def _detect_design_patterns_from_files(self, files: List[str]) -> List[str]:
        patterns: List[str] = []
        file_str = " ".join(files).lower()

        if "factory" in file_str:
            patterns.append("Factory Pattern")
        if "repository" in file_str:
            patterns.append("Repository Pattern")
        if "middleware" in file_str:
            patterns.append("Middleware Pattern")
        if "observer" in file_str or "event" in file_str:
            patterns.append("Observer/Event Pattern")
        if "decorator" in file_str:
            patterns.append("Decorator Pattern")
        if "schema" in file_str:
            patterns.append("Schema Validation (Pydantic/Marshmallow)")
        if "celery" in file_str or "task" in file_str:
            patterns.append("Task Queue Pattern")
        if "api/v" in file_str or "v1" in file_str:
            patterns.append("Versioned API")

        return patterns

    def _generate_summary(
        self,
        tech_stack: Dict[str, Any],
        components: List[str],
        patterns: List[str],
    ) -> str:
        langs = list(tech_stack.get("languages", {}).keys())
        frameworks = list(tech_stack.get("frameworks", {}).keys())
        dbs = list(tech_stack.get("databases", {}).keys())
        tools = list(tech_stack.get("tools", {}).keys())

        summary_parts = []
        if langs:
            summary_parts.append(f"**Languages**: {', '.join(langs)}")
        if frameworks:
            summary_parts.append(f"**Frameworks**: {', '.join(frameworks)}")
        if dbs:
            summary_parts.append(f"**Databases**: {', '.join(dbs)}")
        if tools:
            summary_parts.append(f"**Tools**: {', '.join(tools)}")
        if components:
            summary_parts.append(f"**Main Components**: {', '.join(components[:5])}")
        if patterns:
            summary_parts.append(f"**Design Patterns**: {', '.join(patterns)}")

        return "\n".join(summary_parts) or "No architecture information available."
