from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory

logger = logging.getLogger(__name__)

_DOC_SYSTEM = """\
You are a technical writer and developer advocate. Write clear, comprehensive, and developer-friendly documentation.
Use proper markdown formatting, include practical examples, and make documentation scannable with headings and lists."""


class DocGenerationAgent:
    """Generates various forms of documentation for a repository."""

    async def generate_readme(
        self,
        repo_id: str,
        architecture_report: Optional[Any] = None,
    ) -> str:
        try:
            arch_info = ""
            if architecture_report:
                arch_info = f"\n\nArchitecture Summary:\n{architecture_report.architecture_summary}"
                tech = architecture_report.tech_stack
                langs = list(tech.get("languages", {}).keys())
                frameworks = list(tech.get("frameworks", {}).keys())
                if langs:
                    arch_info += f"\n\nLanguages: {', '.join(langs)}"
                if frameworks:
                    arch_info += f"\nFrameworks: {', '.join(frameworks)}"
            else:
                # Fetch from RAG if no architecture report
                try:
                    from app.intelligence.rag_pipeline import rag_pipeline
                    rag_result = await rag_pipeline.run(
                        repo_id,
                        "What does this project do? What are the main features and architecture?",
                    )
                    arch_info = f"\n\nCodebase Context:\n{rag_result.answer}"
                except Exception:
                    arch_info = ""

            llm = llm_factory.get_llm(temperature=0.2, streaming=False)
            prompt = f"""Generate a comprehensive README.md for a software project with the following information:
{arch_info}

Create a professional README with these sections:
# Project Name
## Overview
## Features
## Tech Stack
## Prerequisites
## Installation
## Configuration
## Usage / Quick Start
## API Reference (if applicable)
## Project Structure
## Contributing
## License

Make it engaging, informative, and developer-friendly. Use emojis appropriately.
Return ONLY the markdown content."""

            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_DOC_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )
            return response.content

        except Exception as exc:
            logger.error("README generation failed: %s", exc)
            return f"# Project Documentation\n\nDocumentation generation failed: {exc}"

    async def generate_api_docs(
        self, router_files: list[str], base_url: str
    ) -> str:
        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        router_content = "\n\n---\n\n".join(router_files[:5])
        prompt = f"""Generate comprehensive API documentation in markdown format for the following FastAPI router code.
Base URL: {base_url}

Router code:
{router_content[:6000]}

Include for each endpoint:
- HTTP method and path
- Description
- Request parameters (path, query, body)
- Response schema and status codes
- Authentication requirements
- Example request/response

Format as clear markdown with proper headings."""

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_DOC_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )
            return response.content
        except Exception as exc:
            logger.error("API docs generation failed: %s", exc)
            return f"# API Documentation\n\nGeneration failed: {exc}"

    async def generate_architecture_doc(
        self, architecture_report: Any
    ) -> str:
        llm = llm_factory.get_llm(temperature=0.2, streaming=False)

        tech_str = str(architecture_report.tech_stack) if architecture_report else "Unknown"
        mermaid = architecture_report.mermaid_diagram if architecture_report else "graph TD\n  A[No data]"
        summary = architecture_report.architecture_summary if architecture_report else ""
        patterns = architecture_report.design_patterns if architecture_report else []

        prompt = f"""Generate an Architecture Decision Record (ADR) style architecture document.

Tech Stack: {tech_str}
Design Patterns: {', '.join(patterns)}
Architecture Summary: {summary}

Mermaid Diagram:
```mermaid
{mermaid}
```

Write a comprehensive architecture document including:
1. Executive Summary
2. System Architecture Overview
3. Component Descriptions
4. Technology Choices and Rationale
5. Data Flow
6. Security Considerations
7. Scalability Considerations
8. Architecture Diagram (embed the Mermaid code)
9. Open Questions and Future Decisions

Format in professional markdown."""

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_DOC_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )
            return response.content
        except Exception as exc:
            logger.error("Architecture doc generation failed: %s", exc)
            return f"# Architecture Documentation\n\nGeneration failed: {exc}"

    async def generate_onboarding(self, repo_id: str) -> str:
        try:
            from app.intelligence.rag_pipeline import rag_pipeline
            rag_result = await rag_pipeline.run(
                repo_id,
                "How do I set up this project locally? What are the main concepts and conventions?",
            )
            context = rag_result.answer
        except Exception:
            context = "No context available."

        llm = llm_factory.get_llm(temperature=0.2, streaming=False)
        prompt = f"""Based on the following project information, create a developer onboarding guide:

{context}

Write a comprehensive onboarding guide covering:
1. Project Overview & Purpose
2. Prerequisites & System Requirements
3. Local Development Setup (step by step)
4. Understanding the Codebase Structure
5. Key Concepts & Architecture
6. Development Workflow (branching, commits, PRs)
7. Running Tests
8. Common Tasks & How-Tos
9. Debugging Tips
10. Getting Help & Resources

Make it beginner-friendly but comprehensive. Format in clear markdown."""

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_DOC_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )
            return response.content
        except Exception as exc:
            logger.error("Onboarding guide generation failed: %s", exc)
            return f"# Developer Onboarding Guide\n\nGeneration failed: {exc}"
