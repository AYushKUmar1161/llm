from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory
from app.intelligence.ast_parser import ASTParser, CodeSymbol

logger = logging.getLogger(__name__)

_TEST_SYSTEM = """\
You are an expert software test engineer. Generate comprehensive, production-quality tests.
Write tests that cover happy paths, edge cases, error conditions, and boundary values.
Follow the project's existing test conventions and use realistic test data."""

_UNIT_TEST_PROMPT = """\
Generate comprehensive unit tests for the following {language} code.
File: {file_path}

```{language}
{content}
```

Write a complete test file using {framework}. Include:
1. Tests for each function/method
2. Happy path tests
3. Edge cases and boundary conditions
4. Error/exception handling tests
5. Mock external dependencies appropriately

Return ONLY the complete test file content, no explanation."""

_INTEGRATION_PROMPT = """\
Generate integration tests for these API endpoints:
{endpoints}

Use {framework} with async test client. Cover:
1. Successful requests
2. Authentication/authorization
3. Validation errors
4. Not found cases
5. Edge cases

Return ONLY the complete test file content."""

_EDGE_CASE_PROMPT = """\
For the function with this signature and docstring:
{signature}
{docstring}

List 5-10 important edge cases to test. Return as a JSON array of strings.
Each string should describe one specific edge case scenario."""


@dataclass
class TestSuite:
    unit_tests: str
    integration_tests: str
    edge_cases: List[str]
    coverage_estimate: float
    framework: str


def _detect_framework(file_path: str) -> str:
    ext = Path(file_path).suffix.lower()
    if ext in (".js", ".ts", ".jsx", ".tsx"):
        return "jest"
    return "pytest"


class TestEngineerAgent:
    """Generates unit tests, integration tests, and edge cases for code."""

    async def generate_tests(
        self,
        file_content: str,
        file_path: str,
        repo_id: Optional[str] = None,
        framework: Optional[str] = None,
    ) -> TestSuite:
        ext = Path(file_path).suffix.lower()
        language = "python" if ext == ".py" else ("javascript" if ext in (".js", ".jsx") else "typescript")
        resolved_framework = framework or _detect_framework(file_path)

        # Parse symbols for edge case detection
        parser = ASTParser()
        symbols = parser.parse_file(file_path, file_content)
        functions = [s for s in symbols if s.symbol_type in ("function", "method")]

        # Generate unit tests
        unit_tests = await self.generate_unit_tests(
            symbols, file_content, file_path, language, resolved_framework
        )

        # Identify edge cases for each function
        edge_cases: List[str] = []
        for sym in functions[:5]:  # Limit to 5 functions
            cases = await self.identify_edge_cases(
                f"{sym.name}({', '.join(sym.parameters)})",
                sym.docstring or "",
            )
            edge_cases.extend(cases)

        # Estimate coverage based on number of tests generated
        test_lines = unit_tests.count("\ndef test_") + unit_tests.count("\nasync def test_")
        coverage_estimate = min(0.95, max(0.3, test_lines * 0.1))

        return TestSuite(
            unit_tests=unit_tests,
            integration_tests="",  # Generated separately via generate_integration_tests
            edge_cases=edge_cases,
            coverage_estimate=coverage_estimate,
            framework=resolved_framework,
        )

    async def generate_unit_tests(
        self,
        symbols: List[CodeSymbol],
        content: str,
        file_path: str,
        language: str,
        framework: str,
    ) -> str:
        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        prompt = _UNIT_TEST_PROMPT.format(
            language=language,
            file_path=file_path,
            content=content[:6000],
            framework=framework,
        )
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_TEST_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )
            result = response.content.strip()
            # Strip code fences
            if result.startswith("```"):
                result = result.split("```", 2)[1]
                if result.startswith(("python", "javascript", "typescript")):
                    result = result.split("\n", 1)[1] if "\n" in result else result
                result = result.rstrip("```").strip()
            return result
        except Exception as exc:
            logger.error("Unit test generation failed: %s", exc)
            return f"# Test generation failed: {exc}\n"

    async def generate_integration_tests(
        self, api_endpoints: List[str], framework: str = "pytest"
    ) -> str:
        llm = llm_factory.get_llm(temperature=0.1, streaming=False)
        endpoints_str = "\n".join(f"- {ep}" for ep in api_endpoints)
        prompt = _INTEGRATION_PROMPT.format(
            endpoints=endpoints_str, framework=framework
        )
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([
                    SystemMessage(content=_TEST_SYSTEM),
                    HumanMessage(content=prompt),
                ]),
            )
            return response.content.strip()
        except Exception as exc:
            logger.error("Integration test generation failed: %s", exc)
            return f"# Integration test generation failed: {exc}\n"

    async def identify_edge_cases(
        self, function_signature: str, docstring: str
    ) -> List[str]:
        llm = llm_factory.get_llm(temperature=0.2, streaming=False)
        prompt = _EDGE_CASE_PROMPT.format(
            signature=function_signature, docstring=docstring or "No docstring available."
        )
        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: llm.invoke([HumanMessage(content=prompt)]),
            )
            raw = response.content.strip()
            if raw.startswith("["):
                cases = json.loads(raw)
                return [str(c) for c in cases]
            # Fallback: parse line by line
            return [
                line.lstrip("•-123456789. ").strip()
                for line in raw.split("\n")
                if line.strip()
            ][:10]
        except Exception as exc:
            logger.debug("Edge case detection failed: %s", exc)
            return []
