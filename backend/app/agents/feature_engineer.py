from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory
from app.intelligence.rag_pipeline import rag_pipeline

logger = logging.getLogger(__name__)

_FEATURE_SYSTEM = """\
You are an expert software architect and senior developer. 
When planning a feature, analyze the existing codebase structure carefully and generate 
coherent, production-quality code that integrates seamlessly with the existing patterns.
Always follow the project's conventions, frameworks, and coding style."""

_PLAN_PROMPT = """\
Based on the following codebase context, plan and implement the requested feature.

Feature request: {feature_description}

Codebase context:
{context}

Provide a comprehensive implementation plan as JSON with this exact structure:
{{
  "impacted_files": ["list of files that need to be modified or created"],
  "implementation_steps": ["ordered list of implementation steps"],
  "code_changes": [
    {{
      "file_path": "path/to/file",
      "change_type": "create|modify|delete",
      "content": "full file content or diff",
      "description": "what changed and why"
    }}
  ],
  "migrations": ["any database migrations needed"],
  "tests": ["test cases to add"],
  "unified_diff": "unified diff string if applicable",
  "summary": "brief summary of the implementation"
}}

Return ONLY valid JSON."""


@dataclass
class FileChange:
    file_path: str
    change_type: str  # create | modify | delete
    content: str
    description: str


@dataclass
class FeaturePlan:
    impacted_files: List[str]
    implementation_steps: List[str]
    code_changes: List[FileChange]
    migrations: List[str]
    tests: List[str]
    unified_diff: str
    summary: str


class FeatureEngineerAgent:
    """Plans and generates code for new features based on the existing codebase."""

    async def plan_feature(
        self, feature_description: str, repo_id: str
    ) -> FeaturePlan:
        # Retrieve relevant context from the repo
        try:
            rag_result = await rag_pipeline.run(
                repo_id,
                f"How is the codebase structured for implementing: {feature_description}",
            )
            context = "\n".join(s.get("content", "") for s in rag_result.sources[:5])
        except Exception as exc:
            logger.warning("Failed to retrieve context: %s", exc)
            context = "No context available."

        llm = llm_factory.get_llm(temperature=0.2, streaming=False)
        prompt = _PLAN_PROMPT.format(
            feature_description=feature_description,
            context=context[:6000],
        )

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_FEATURE_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )

            raw = response.content.strip()
            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("```", 2)[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()
                if raw.endswith("```"):
                    raw = raw[:-3].strip()

            data = json.loads(raw)
            code_changes = [
                FileChange(
                    file_path=ch.get("file_path", ""),
                    change_type=ch.get("change_type", "modify"),
                    content=ch.get("content", ""),
                    description=ch.get("description", ""),
                )
                for ch in data.get("code_changes", [])
            ]

            return FeaturePlan(
                impacted_files=data.get("impacted_files", []),
                implementation_steps=data.get("implementation_steps", []),
                code_changes=code_changes,
                migrations=data.get("migrations", []),
                tests=data.get("tests", []),
                unified_diff=data.get("unified_diff", ""),
                summary=data.get("summary", "Feature plan generated."),
            )

        except json.JSONDecodeError as exc:
            logger.error("Failed to parse feature plan JSON: %s", exc)
            # Return a best-effort plain-text plan
            return FeaturePlan(
                impacted_files=[],
                implementation_steps=[response.content if "response" in dir() else "Analysis failed."],
                code_changes=[],
                migrations=[],
                tests=[],
                unified_diff="",
                summary=f"Feature planning encountered a parsing error: {exc}",
            )
        except Exception as exc:
            logger.error("Feature planning failed: %s", exc)
            return FeaturePlan(
                impacted_files=[],
                implementation_steps=[],
                code_changes=[],
                migrations=[],
                tests=[],
                unified_diff="",
                summary=f"Feature planning failed: {exc}",
            )
