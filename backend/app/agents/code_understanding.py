from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory
from app.intelligence.rag_pipeline import rag_pipeline

logger = logging.getLogger(__name__)

_EXPLAIN_SYSTEM = """\
You are an expert software engineer. Explain the provided code clearly and concisely.
Include: what it does, how it works, key design decisions, potential issues, and usage examples.
Format with markdown headings and code blocks."""

_PATTERN_PROMPT = """\
Analyze the following {language} code and identify software design patterns used.
Return a JSON array of pattern names, e.g. ["Singleton", "Factory", "Observer"].
Only include patterns that are clearly evident. Return ONLY the JSON array.

Code:
{code}"""


@dataclass
class Explanation:
    content: str
    sources: List[Dict[str, Any]] = field(default_factory=list)
    context: str = ""
    patterns: List[str] = field(default_factory=list)


class CodeUnderstandingAgent:
    """Explains code using RAG-retrieved context and LLM synthesis."""

    async def explain(
        self,
        query: str,
        repo_id: str,
        context_files: Optional[List[str]] = None,
    ) -> Explanation:
        try:
            rag_result = await rag_pipeline.run(repo_id, query)
            return Explanation(
                content=rag_result.answer,
                sources=rag_result.sources,
                context="\n".join(s.get("content", "") for s in rag_result.sources),
            )
        except Exception as exc:
            logger.error("Code explanation failed: %s", exc)
            return Explanation(
                content=f"I encountered an error while retrieving context: {exc}",
            )

    async def explain_function(
        self, file_path: str, function_name: str, content: str
    ) -> str:
        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        prompt = f"""Explain this function from `{file_path}`:

```
{content[:4000]}
```

Focus on:
1. What the function `{function_name}` does
2. Its parameters and return value
3. Any side effects or important behavior
4. Example usage
"""
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: llm.invoke([
                SystemMessage(content=_EXPLAIN_SYSTEM),
                HumanMessage(content=prompt),
            ]),
        )
        return response.content

    async def explain_class(
        self, file_path: str, class_name: str, content: str
    ) -> str:
        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        prompt = f"""Explain this class from `{file_path}`:

```
{content[:4000]}
```

Focus on:
1. The purpose and responsibility of `{class_name}`
2. Key methods and their roles
3. How it's used within the codebase
4. Design patterns applied
"""
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: llm.invoke([
                SystemMessage(content=_EXPLAIN_SYSTEM),
                HumanMessage(content=prompt),
            ]),
        )
        return response.content

    async def detect_patterns(self, content: str, language: str) -> List[str]:
        import json as _json

        llm = llm_factory.get_llm(temperature=0.0, streaming=False)
        prompt = _PATTERN_PROMPT.format(language=language, code=content[:3000])
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            patterns = _json.loads(response.content.strip())
            if isinstance(patterns, list):
                return [str(p) for p in patterns]
        except Exception as exc:
            logger.debug("Pattern detection failed: %s", exc)
        return []
