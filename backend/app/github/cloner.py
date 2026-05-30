from __future__ import annotations

import logging
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import git

logger = logging.getLogger(__name__)

# Files / directories to exclude from indexing
_EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", "dist", "build", "venv",
    ".venv", "env", ".env", ".tox", ".mypy_cache", ".pytest_cache",
    ".idea", ".vscode", "coverage", ".next", ".nuxt", "out", "target",
    "vendor", "third_party", "bower_components", ".yarn",
}

_EXCLUDE_PATTERNS = {
    ".env", ".env.local", ".env.production", ".env.development",
    "*.pyc", "*.pyo", "*.pyd", "*.so", "*.dll", "*.dylib",
    "*.min.js", "*.min.css", "*.map", "*.lock",
    "package-lock.json", "yarn.lock", "Pipfile.lock", "poetry.lock",
    "*.jpg", "*.jpeg", "*.png", "*.gif", "*.svg", "*.ico",
    "*.pdf", "*.docx", "*.xlsx", "*.zip", "*.tar.gz",
}

_TEXT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".go", ".rs",
    ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".swift", ".scala",
    ".sh", ".bash", ".zsh", ".sql", ".md", ".txt", ".rst", ".yaml", ".yml",
    ".toml", ".json", ".xml", ".html", ".css", ".scss", ".sass", ".less",
    ".vue", ".svelte", ".astro", ".graphql", ".gql", ".proto",
    "Dockerfile", ".gitignore", ".dockerignore", "Makefile",
}


class RepositoryCloner:
    """Clones, updates, and reads GitHub repositories using GitPython."""

    def __init__(self, base_path: Optional[str] = None) -> None:
        from app.core.config import settings
        self.base_path = Path(base_path or settings.REPOS_BASE_PATH)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _repo_path(self, repo_id: str) -> Path:
        return self.base_path / repo_id

    def _auth_url(self, github_url: str, token: Optional[str]) -> str:
        if token:
            # Inject token into HTTPS URL
            url = github_url.replace("https://", f"https://{token}@")
            return url
        return github_url

    # ------------------------------------------------------------------
    # Clone / Update
    # ------------------------------------------------------------------

    def clone_repo(
        self,
        github_url: str,
        repo_id: str,
        token: Optional[str] = None,
        progress_callback: Optional[Callable[[str, int], None]] = None,
    ) -> str:
        local_path = self._repo_path(repo_id)

        if local_path.exists():
            logger.info("Repo %s already exists at %s, pulling...", repo_id, local_path)
            return self.update_repo(str(local_path))

        auth_url = self._auth_url(github_url, token)
        logger.info("Cloning %s to %s", github_url, local_path)

        try:
            repo = git.Repo.clone_from(
                auth_url,
                str(local_path),
                depth=50,  # shallow clone for speed
            )
            if progress_callback:
                progress_callback("clone_complete", 100)
            return str(local_path)
        except git.GitCommandError as exc:
            logger.error("Clone failed for %s: %s", github_url, exc)
            raise RuntimeError(f"Clone failed: {exc}") from exc

    def update_repo(self, local_path: str) -> str:
        """Pull latest changes and return new HEAD SHA."""
        try:
            repo = git.Repo(local_path)
            origin = repo.remotes.origin
            origin.pull()
            return repo.head.commit.hexsha
        except git.GitCommandError as exc:
            logger.error("Pull failed at %s: %s", local_path, exc)
            raise RuntimeError(f"Pull failed: {exc}") from exc

    # ------------------------------------------------------------------
    # Diff
    # ------------------------------------------------------------------

    def get_diff(self, local_path: str, from_sha: str, to_sha: str) -> str:
        try:
            repo = git.Repo(local_path)
            return repo.git.diff(from_sha, to_sha, unified=3)
        except git.GitCommandError as exc:
            logger.error("Diff failed: %s", exc)
            return ""

    # ------------------------------------------------------------------
    # File listing and reading
    # ------------------------------------------------------------------

    def list_files(
        self,
        local_path: str,
        extensions: Optional[List[str]] = None,
        exclude_patterns: Optional[List[str]] = None,
    ) -> List[str]:
        root = Path(local_path)
        files: List[str] = []
        ext_filter = {e.lower() for e in extensions} if extensions else None
        extra_exclude = set(exclude_patterns or [])

        for path in root.rglob("*"):
            if not path.is_file():
                continue

            # Check excluded directories
            parts = path.relative_to(root).parts
            if any(p in _EXCLUDE_DIRS for p in parts[:-1]):
                continue

            # Check excluded patterns
            name = path.name
            if name in _EXCLUDE_PATTERNS or name in extra_exclude:
                continue

            # Check extension filter
            suffix = path.suffix.lower()
            if ext_filter:
                if suffix not in ext_filter:
                    continue
            else:
                # Default: only text files
                if suffix not in _TEXT_EXTENSIONS and name not in _TEXT_EXTENSIONS:
                    continue

            # Skip binary / large files
            try:
                if path.stat().st_size > 5 * 1024 * 1024:  # 5 MB limit
                    continue
            except OSError:
                continue

            files.append(str(path.relative_to(root)))

        files.sort()
        return files

    def read_file(self, local_path: str, relative_path: str) -> str:
        full_path = Path(local_path) / relative_path
        try:
            return full_path.read_text(encoding="utf-8", errors="replace")
        except Exception as exc:
            logger.warning("Could not read file %s: %s", full_path, exc)
            return ""

    # ------------------------------------------------------------------
    # Repository stats
    # ------------------------------------------------------------------

    def get_repo_stats(self, local_path: str) -> Dict[str, Any]:
        files = self.list_files(local_path)
        total_lines = 0
        languages: Dict[str, int] = defaultdict(int)

        for rel_path in files:
            content = self.read_file(local_path, rel_path)
            lines = content.count("\n")
            total_lines += lines

            suffix = Path(rel_path).suffix.lower()
            lang = _EXT_TO_LANG.get(suffix, "other")
            languages[lang] += lines

        return {
            "total_files": len(files),
            "total_lines": total_lines,
            "languages": dict(languages),
            "primary_language": max(languages, key=languages.get) if languages else None,
        }


_EXT_TO_LANG: Dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".jsx": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".java": "Java",
    ".kt": "Kotlin",
    ".go": "Go",
    ".rs": "Rust",
    ".rb": "Ruby",
    ".php": "PHP",
    ".cs": "C#",
    ".cpp": "C++",
    ".c": "C",
    ".swift": "Swift",
    ".scala": "Scala",
    ".html": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sql": "SQL",
    ".sh": "Shell",
}
