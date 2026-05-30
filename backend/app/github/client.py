from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

from github import Github, GithubException
from github.Repository import Repository as GHRepo

logger = logging.getLogger(__name__)


@dataclass
class RepoInfo:
    full_name: str
    name: str
    description: Optional[str]
    default_branch: str
    language: Optional[str]
    stars: int
    is_private: bool
    clone_url: str
    html_url: str
    topics: List[str] = field(default_factory=list)
    open_issues: int = 0
    forks: int = 0


@dataclass
class PRInfo:
    number: int
    title: str
    body: Optional[str]
    state: str
    author: str
    base_branch: str
    head_branch: str
    created_at: datetime
    updated_at: datetime
    diff: Optional[str] = None
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0
    labels: List[str] = field(default_factory=list)
    reviewers: List[str] = field(default_factory=list)


@dataclass
class IssueInfo:
    number: int
    title: str
    body: Optional[str]
    state: str
    author: str
    created_at: datetime
    updated_at: datetime
    labels: List[str] = field(default_factory=list)
    assignees: List[str] = field(default_factory=list)


@dataclass
class CommitInfo:
    sha: str
    message: str
    author: str
    author_email: str
    committed_at: datetime
    files_changed: int = 0
    additions: int = 0
    deletions: int = 0


@dataclass
class CodeResult:
    path: str
    repository: str
    html_url: str
    content_snippet: Optional[str] = None


class GitHubClient:
    """
    Thin async-friendly wrapper around PyGithub.
    All blocking PyGithub calls are intentionally synchronous; wrap in
    asyncio.get_event_loop().run_in_executor() at the call site when needed.
    """

    def __init__(self, token: str) -> None:
        self._gh = Github(token, per_page=100)
        self._token = token

    def get_repo(self, full_name: str) -> RepoInfo:
        try:
            repo: GHRepo = self._gh.get_repo(full_name)
            return RepoInfo(
                full_name=repo.full_name,
                name=repo.name,
                description=repo.description,
                default_branch=repo.default_branch,
                language=repo.language,
                stars=repo.stargazers_count,
                is_private=repo.private,
                clone_url=repo.clone_url,
                html_url=repo.html_url,
                topics=repo.get_topics(),
                open_issues=repo.open_issues_count,
                forks=repo.forks_count,
            )
        except GithubException as exc:
            logger.error("Failed to get repo %s: %s", full_name, exc)
            raise

    def list_pull_requests(
        self, full_name: str, state: str = "open"
    ) -> List[PRInfo]:
        repo = self._gh.get_repo(full_name)
        prs = []
        for pr in repo.get_pulls(state=state):
            prs.append(
                PRInfo(
                    number=pr.number,
                    title=pr.title,
                    body=pr.body,
                    state=pr.state,
                    author=pr.user.login,
                    base_branch=pr.base.ref,
                    head_branch=pr.head.ref,
                    created_at=pr.created_at,
                    updated_at=pr.updated_at,
                    files_changed=pr.changed_files,
                    additions=pr.additions,
                    deletions=pr.deletions,
                    labels=[lbl.name for lbl in pr.labels],
                    reviewers=[r.login for r in pr.requested_reviewers],
                )
            )
        return prs

    def get_pull_request(self, full_name: str, number: int) -> PRInfo:
        repo = self._gh.get_repo(full_name)
        pr = repo.get_pull(number)
        # Fetch unified diff
        import httpx

        try:
            resp = httpx.get(
                pr.diff_url,
                headers={
                    "Authorization": f"token {self._token}",
                    "Accept": "application/vnd.github.v3.diff",
                },
                timeout=30,
            )
            diff = resp.text if resp.status_code == 200 else None
        except Exception:
            diff = None

        return PRInfo(
            number=pr.number,
            title=pr.title,
            body=pr.body,
            state=pr.state,
            author=pr.user.login,
            base_branch=pr.base.ref,
            head_branch=pr.head.ref,
            created_at=pr.created_at,
            updated_at=pr.updated_at,
            diff=diff,
            files_changed=pr.changed_files,
            additions=pr.additions,
            deletions=pr.deletions,
            labels=[lbl.name for lbl in pr.labels],
            reviewers=[r.login for r in pr.requested_reviewers],
        )

    def list_issues(self, full_name: str, state: str = "open") -> List[IssueInfo]:
        repo = self._gh.get_repo(full_name)
        issues = []
        for issue in repo.get_issues(state=state):
            if issue.pull_request is not None:
                continue  # Skip PRs
            issues.append(
                IssueInfo(
                    number=issue.number,
                    title=issue.title,
                    body=issue.body,
                    state=issue.state,
                    author=issue.user.login,
                    created_at=issue.created_at,
                    updated_at=issue.updated_at,
                    labels=[lbl.name for lbl in issue.labels],
                    assignees=[u.login for u in issue.assignees],
                )
            )
        return issues

    def get_commits(
        self,
        full_name: str,
        since: Optional[datetime] = None,
        limit: int = 10,
    ) -> List[CommitInfo]:
        repo = self._gh.get_repo(full_name)
        kwargs: Dict[str, Any] = {}
        if since:
            kwargs["since"] = since
        commits = []
        for commit in repo.get_commits(**kwargs)[:limit]:
            stats = commit.stats
            commits.append(
                CommitInfo(
                    sha=commit.sha,
                    message=commit.commit.message,
                    author=commit.commit.author.name,
                    author_email=commit.commit.author.email,
                    committed_at=commit.commit.author.date,
                    files_changed=len(commit.files),
                    additions=stats.additions,
                    deletions=stats.deletions,
                )
            )
        return commits

    def search_code(
        self, query: str, repo: Optional[str] = None
    ) -> List[CodeResult]:
        search_query = query
        if repo:
            search_query = f"{query} repo:{repo}"
        results = []
        for item in self._gh.search_code(search_query)[:20]:
            snippet = None
            try:
                content_file = item.repository.get_contents(item.path)
                raw = content_file.decoded_content.decode("utf-8", errors="replace")
                snippet = raw[:500]
            except Exception:
                pass
            results.append(
                CodeResult(
                    path=item.path,
                    repository=item.repository.full_name,
                    html_url=item.html_url,
                    content_snippet=snippet,
                )
            )
        return results
