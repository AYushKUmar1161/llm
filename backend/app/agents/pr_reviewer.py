from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from app.core.llm_factory import llm_factory

logger = logging.getLogger(__name__)

_REVIEW_SYSTEM = """\
You are a senior code reviewer with expertise in security, performance, and maintainability.
Review the provided code diff thoroughly and provide structured feedback.
Be specific, actionable, and constructive."""

_REVIEW_PROMPT = """\
Review the following code diff{context}:

```diff
{diff}
```

Provide a comprehensive review as JSON with this exact structure:
{{
  "overall_score": <integer 0-100>,
  "risk_level": "<low|medium|high|critical>",
  "complexity_score": <integer 0-100>,
  "security_issues": [
    {{
      "severity": "<critical|high|medium|low>",
      "description": "...",
      "file_path": "...",
      "line_number": <int or null>,
      "suggestion": "..."
    }}
  ],
  "maintainability_issues": [
    {{
      "severity": "<critical|high|medium|low>",
      "description": "...",
      "file_path": "...",
      "line_number": <int or null>,
      "suggestion": "..."
    }}
  ],
  "performance_issues": [
    {{
      "severity": "<critical|high|medium|low>",
      "description": "...",
      "file_path": "...",
      "line_number": <int or null>,
      "suggestion": "..."
    }}
  ],
  "suggestions": ["general suggestion 1", "general suggestion 2"],
  "summary": "overall review summary"
}}

Return ONLY valid JSON."""


@dataclass
class CodeIssue:
    severity: str
    description: str
    file_path: str
    line_number: Optional[int]
    suggestion: str


@dataclass
class ReviewReport:
    overall_score: int
    security_issues: List[CodeIssue]
    maintainability_issues: List[CodeIssue]
    performance_issues: List[CodeIssue]
    complexity_score: int
    suggestions: List[str]
    risk_level: str
    summary: str

    @property
    def total_issues(self) -> int:
        return (
            len(self.security_issues)
            + len(self.maintainability_issues)
            + len(self.performance_issues)
        )


def _parse_issues(raw: List[Dict[str, Any]]) -> List[CodeIssue]:
    issues = []
    for item in raw:
        issues.append(
            CodeIssue(
                severity=item.get("severity", "low"),
                description=item.get("description", ""),
                file_path=item.get("file_path", ""),
                line_number=item.get("line_number"),
                suggestion=item.get("suggestion", ""),
            )
        )
    return issues


class PRReviewAgent:
    """Reviews code diffs and produces structured review reports."""

    async def review(
        self,
        diff_content: str,
        repo_id: Optional[str] = None,
        pr_title: Optional[str] = None,
        pr_description: Optional[str] = None,
    ) -> ReviewReport:
        context_str = ""
        if pr_title:
            context_str = f" (PR: {pr_title})"

        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        prompt = _REVIEW_PROMPT.format(
            diff=diff_content[:8000],
            context=context_str,
        )

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_REVIEW_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )

            raw = response.content.strip()
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip().rstrip("```").strip()

            data = json.loads(raw)
            return ReviewReport(
                overall_score=int(data.get("overall_score", 70)),
                security_issues=_parse_issues(data.get("security_issues", [])),
                maintainability_issues=_parse_issues(data.get("maintainability_issues", [])),
                performance_issues=_parse_issues(data.get("performance_issues", [])),
                complexity_score=int(data.get("complexity_score", 50)),
                suggestions=data.get("suggestions", []),
                risk_level=data.get("risk_level", "medium"),
                summary=data.get("summary", "Review completed."),
            )

        except Exception as exc:
            logger.error("PR review failed: %s", exc)
            return ReviewReport(
                overall_score=0,
                security_issues=[],
                maintainability_issues=[],
                performance_issues=[],
                complexity_score=0,
                suggestions=["Review failed. Please try again."],
                risk_level="unknown",
                summary=f"Review failed: {exc}",
            )
